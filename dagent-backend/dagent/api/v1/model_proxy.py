from __future__ import annotations

import json
import re
import time
from typing import Any, Literal
from urllib.parse import urljoin
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select

from dagent.api.deps import SessionDep, verify_agent_callback_token
from dagent.api.errors import DagentError
from dagent.api.schemas.model_gateway import (
    ModelFallbackRequest,
    ModelReservationRequest,
    ModelSettlementRequest,
)
from dagent.models import ModelRoute
from dagent.services.model_gateway import (
    ALL_MODEL_NODES_QUOTA_EXHAUSTED,
    USER_TOTAL_BUDGET_EXHAUSTED,
    configured_api_protocol,
    fail_model_route,
    fallback_model_route,
    reserve_model_route,
    resolve_model_credential,
    settle_model_route,
)

router = APIRouter(dependencies=[Depends(verify_agent_callback_token)])
TASK_PATTERN = re.compile(r"\[DAGENT_CONTEXT\s+task_id=(\d+)")


def _flatten_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(_flatten_text(item) for item in value)
    if isinstance(value, dict):
        if isinstance(value.get("text"), str):
            return str(value["text"])
        if "content" in value:
            return _flatten_text(value["content"])
    return ""


def _task_id(payload: dict[str, Any]) -> int:
    metadata = payload.get("metadata")
    if isinstance(metadata, dict) and str(metadata.get("dagent_task_id", "")).isdigit():
        return int(metadata["dagent_task_id"])
    text = _flatten_text(payload.get("messages", []))
    match = TASK_PATTERN.search(text)
    if match:
        return int(match.group(1))
    raise HTTPException(status_code=422, detail="Dagent task context is missing from model request")


def _estimated_tokens(payload: dict[str, Any]) -> tuple[int, int]:
    input_tokens = max(1, len(_flatten_text(payload.get("messages", []))) // 4)
    output_budget = int(payload.get("max_tokens") or payload.get("max_completion_tokens") or 4096)
    output_budget = max(1, min(output_budget, 100_000))
    return input_tokens, input_tokens + output_budget


def _responses_input(messages: object) -> list[dict[str, Any]]:
    if not isinstance(messages, list):
        return []
    items: list[dict[str, Any]] = []
    for message in messages:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role") or "user")
        if role == "tool":
            call_id = str(message.get("tool_call_id") or "")
            if call_id:
                items.append(
                    {
                        "type": "function_call_output",
                        "call_id": call_id,
                        "output": _flatten_text(message.get("content")),
                    }
                )
            continue
        content = _flatten_text(message.get("content"))
        if content:
            items.append({"role": role, "content": content})
        tool_calls = message.get("tool_calls")
        if role == "assistant" and isinstance(tool_calls, list):
            for tool_call in tool_calls:
                if not isinstance(tool_call, dict):
                    continue
                function = tool_call.get("function")
                if not isinstance(function, dict):
                    continue
                items.append(
                    {
                        "type": "function_call",
                        "call_id": str(tool_call.get("id") or uuid4().hex),
                        "name": str(function.get("name") or ""),
                        "arguments": str(function.get("arguments") or "{}"),
                    }
                )
    return items


def _responses_tools(tools: object) -> list[dict[str, Any]]:
    if not isinstance(tools, list):
        return []
    converted: list[dict[str, Any]] = []
    for tool in tools:
        if not isinstance(tool, dict) or tool.get("type") != "function":
            continue
        function = tool.get("function")
        if not isinstance(function, dict) or not function.get("name"):
            continue
        item: dict[str, Any] = {
            "type": "function",
            "name": function["name"],
            "parameters": function.get("parameters") or {"type": "object", "properties": {}},
        }
        if function.get("description"):
            item["description"] = function["description"]
        if "strict" in function:
            item["strict"] = function["strict"]
        converted.append(item)
    return converted


def _responses_request(payload: dict[str, Any], model: str) -> dict[str, Any]:
    result: dict[str, Any] = {
        "model": model,
        "input": _responses_input(payload.get("messages")),
        "stream": False,
    }
    output_budget = payload.get("max_completion_tokens") or payload.get("max_tokens")
    if output_budget is not None:
        result["max_output_tokens"] = output_budget
    for field in ("temperature", "top_p", "tool_choice", "parallel_tool_calls"):
        if field in payload:
            result[field] = payload[field]
    tools = _responses_tools(payload.get("tools"))
    if tools:
        result["tools"] = tools
    return result


def _responses_to_chat(body: object, model: str) -> dict[str, Any]:
    if not isinstance(body, dict):
        raise ValueError("Responses API returned a non-object response")
    output = body.get("output")
    if not isinstance(output, list):
        raise ValueError("Responses API returned no output")
    text_parts: list[str] = []
    tool_calls: list[dict[str, Any]] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "message":
            content = item.get("content")
            if isinstance(content, list):
                for block in content:
                    if not isinstance(block, dict) or block.get("type") not in {"output_text", "text"}:
                        continue
                    text = block.get("text")
                    if isinstance(text, str) and text:
                        text_parts.append(text)
        elif item.get("type") == "function_call":
            tool_calls.append(
                {
                    "id": str(item.get("call_id") or item.get("id") or uuid4().hex),
                    "type": "function",
                    "function": {
                        "name": str(item.get("name") or ""),
                        "arguments": str(item.get("arguments") or "{}"),
                    },
                }
            )
    if not text_parts and not tool_calls:
        raise ValueError("Responses API returned no assistant output")
    message: dict[str, Any] = {
        "role": "assistant",
        "content": "\n".join(text_parts) if text_parts else None,
    }
    if tool_calls:
        message["tool_calls"] = tool_calls
    raw_usage = body.get("usage")
    usage: dict[str, Any] = raw_usage if isinstance(raw_usage, dict) else {}
    return {
        "id": str(body.get("id") or f"chatcmpl-{uuid4().hex}"),
        "object": "chat.completion",
        "created": int(time.time()),
        "model": str(body.get("model") or model),
        "choices": [
            {
                "index": 0,
                "message": message,
                "finish_reason": "tool_calls" if tool_calls else "stop",
            }
        ],
        "usage": {
            "prompt_tokens": int(usage.get("input_tokens") or 0),
            "completion_tokens": int(usage.get("output_tokens") or 0),
            "total_tokens": int(usage.get("total_tokens") or 0),
        },
    }


def _normalized_upstream_response(
    protocol: str,
    response: httpx.Response,
    model: str,
) -> tuple[bytes, str]:
    content_type = response.headers.get("content-type", "application/json")
    if protocol == "chat_completions" and "text/event-stream" in content_type:
        return response.content, content_type
    try:
        body = response.json()
    except ValueError as exc:
        raise ValueError(f"{protocol} returned invalid JSON") from exc
    if protocol == "responses":
        body = _responses_to_chat(body, model)
    elif not isinstance(body, dict) or not isinstance(body.get("choices"), list) or not body["choices"]:
        raise ValueError("Chat Completions API returned no choices")
    return json.dumps(body, ensure_ascii=False).encode("utf-8"), "application/json"


def _usage(body: bytes, content_type: str, estimated_input: int, reserved: int) -> tuple[int, int, bool]:
    input_tokens = 0
    output_tokens = 0
    output_text = ""
    candidates: list[dict[str, Any]] = []
    decoded = body.decode("utf-8", errors="replace")
    if "text/event-stream" in content_type:
        for line in decoded.splitlines():
            if not line.startswith("data:"):
                continue
            value = line.removeprefix("data:").strip()
            if value == "[DONE]":
                continue
            try:
                item = json.loads(value)
            except json.JSONDecodeError:
                continue
            if isinstance(item, dict):
                candidates.append(item)
                for choice in item.get("choices", []):
                    output_text += _flatten_text(choice.get("delta", {}))
    else:
        try:
            item = json.loads(decoded)
        except json.JSONDecodeError:
            item = None
        if isinstance(item, dict):
            candidates.append(item)
            for choice in item.get("choices", []):
                output_text += _flatten_text(choice.get("message", {}))
    for item in candidates:
        usage = item.get("usage")
        if isinstance(usage, dict):
            input_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or input_tokens)
            output_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or output_tokens)
    estimated = not (input_tokens or output_tokens)
    if estimated:
        input_tokens = estimated_input
        output_tokens = max(1, len(output_text) // 4)
    input_tokens = min(input_tokens, reserved)
    output_tokens = min(output_tokens, max(0, reserved - input_tokens))
    return input_tokens, output_tokens, estimated


def _fallback_error(
    status_code: int,
) -> Literal["rate_limited", "server_error", "authentication_error"] | None:
    if status_code in {401, 403}:
        return "authentication_error"
    if status_code == 429:
        return "rate_limited"
    if status_code >= 500:
        return "server_error"
    return None


def _quota_error_response(exc: DagentError) -> JSONResponse | None:
    if exc.message not in {ALL_MODEL_NODES_QUOTA_EXHAUSTED, USER_TOTAL_BUDGET_EXHAUSTED}:
        return None
    # OpenAI-compatible clients automatically retry 409 regardless of this body's retryable flag.
    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "message": exc.message,
                "type": "quota_exhausted",
                "retryable": False,
            }
        },
    )


@router.get("/model-proxy/v1/models")
async def models(session: SessionDep) -> dict[str, Any]:
    routes = list(
        (
            await session.scalars(
                select(ModelRoute).where(ModelRoute.status == "active").order_by(ModelRoute.priority, ModelRoute.id)
            )
        ).all()
    )
    return {
        "object": "list",
        "data": [{"id": route.model, "object": "model", "owned_by": route.provider} for route in routes],
    }


@router.post("/model-proxy/v1/chat/completions")
async def chat_completions(request: Request, session: SessionDep) -> Response:
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Model request must be a JSON object")
    task_id = _task_id(payload)
    estimated_input, estimated_total = _estimated_tokens(payload)
    request_id = request.headers.get("X-Request-Id") or uuid4().hex
    environment = request.headers.get("X-Dagent-Environment") or "production"
    try:
        reservation = await reserve_model_route(
            session,
            ModelReservationRequest(
                task_id=task_id,
                request_id=request_id,
                estimated_tokens=estimated_total,
                estimated_input_tokens=estimated_input,
                output_token_budget=estimated_total - estimated_input,
                environment=environment,
            ),
        )
    except DagentError as exc:
        quota_response = _quota_error_response(exc)
        if quota_response is not None:
            return quota_response
        raise
    clean_payload = dict(payload)
    clean_payload.pop("metadata", None)

    while True:
        route = reservation.route
        clean_payload["model"] = route.model
        protocol = configured_api_protocol(route)
        upstream_path = "responses" if protocol == "responses" else "chat/completions"
        upstream_payload = (
            _responses_request(clean_payload, route.model)
            if protocol == "responses"
            else clean_payload
        )
        started = time.perf_counter()
        credential = resolve_model_credential(route.credential_ref, route.credential_ciphertext)
        headers = {"Authorization": f"Bearer {credential}"} if credential else {}
        try:
            async with httpx.AsyncClient(timeout=route.timeout_ms / 1000, follow_redirects=False) as client:
                upstream = await client.post(
                    urljoin(route.base_url.rstrip("/") + "/", upstream_path),
                    json=upstream_payload,
                    headers=headers,
                )
            latency_ms = int((time.perf_counter() - started) * 1000)
            error_type = _fallback_error(upstream.status_code)
            if error_type:
                try:
                    reservation = await fallback_model_route(
                        session,
                        request_id,
                        ModelFallbackRequest(
                            task_id=task_id,
                            attempt_no=reservation.attempt_no,
                            estimated_tokens=estimated_total,
                            estimated_input_tokens=estimated_input,
                            output_token_budget=estimated_total - estimated_input,
                            error_type=error_type,
                            error_code=str(upstream.status_code),
                            latency_ms=latency_ms,
                            environment=environment,
                        ),
                    )
                    continue
                except DagentError as exc:
                    await fail_model_route(
                        session,
                        request_id,
                        task_id=task_id,
                        attempt_no=reservation.attempt_no,
                        error_type=error_type,
                        error_code=str(upstream.status_code),
                        latency_ms=latency_ms,
                    )
                    quota_response = _quota_error_response(exc)
                    if quota_response is not None:
                        return quota_response
                    return Response(
                        content=upstream.content,
                        status_code=upstream.status_code,
                        media_type=upstream.headers.get("content-type", "application/json"),
                    )
            if upstream.status_code >= 400:
                await fail_model_route(
                    session,
                    request_id,
                    task_id=task_id,
                    attempt_no=reservation.attempt_no,
                    error_type="server_error",
                    error_code=str(upstream.status_code),
                    latency_ms=latency_ms,
                )
                return Response(
                    content=upstream.content,
                    status_code=upstream.status_code,
                    media_type=upstream.headers.get("content-type", "application/json"),
                )
            try:
                response_content, content_type = _normalized_upstream_response(
                    protocol,
                    upstream,
                    route.model,
                )
            except ValueError:
                try:
                    reservation = await fallback_model_route(
                        session,
                        request_id,
                        ModelFallbackRequest(
                            task_id=task_id,
                            attempt_no=reservation.attempt_no,
                            estimated_tokens=estimated_total,
                            estimated_input_tokens=estimated_input,
                            output_token_budget=estimated_total - estimated_input,
                            error_type="server_error",
                            error_code="invalid_response",
                            latency_ms=latency_ms,
                            environment=environment,
                        ),
                    )
                    continue
                except DagentError as exc:
                    await fail_model_route(
                        session,
                        request_id,
                        task_id=task_id,
                        attempt_no=reservation.attempt_no,
                        error_type="server_error",
                        error_code="invalid_response",
                        latency_ms=latency_ms,
                    )
                    quota_response = _quota_error_response(exc)
                    if quota_response is not None:
                        return quota_response
                    return JSONResponse(
                        status_code=502,
                        content={
                            "error": {
                                "message": "Model route returned an invalid response",
                                "type": "upstream",
                            }
                        },
                    )
            input_tokens, output_tokens, estimated = _usage(
                response_content,
                content_type,
                estimated_input,
                reservation.reserved_tokens,
            )
            await settle_model_route(
                session,
                request_id,
                ModelSettlementRequest(
                    task_id=task_id,
                    attempt_no=reservation.attempt_no,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    latency_ms=latency_ms,
                    usage_estimated=estimated,
                ),
            )
            return Response(content=response_content, status_code=upstream.status_code, media_type=content_type)
        except httpx.TimeoutException:
            latency_ms = int((time.perf_counter() - started) * 1000)
            try:
                reservation = await fallback_model_route(
                    session,
                    request_id,
                    ModelFallbackRequest(
                        task_id=task_id,
                        attempt_no=reservation.attempt_no,
                        estimated_tokens=estimated_total,
                        estimated_input_tokens=estimated_input,
                        output_token_budget=estimated_total - estimated_input,
                        error_type="timeout",
                        latency_ms=latency_ms,
                        environment=environment,
                    ),
                )
            except DagentError as exc:
                await fail_model_route(
                    session,
                    request_id,
                    task_id=task_id,
                    attempt_no=reservation.attempt_no,
                    error_type="timeout",
                    error_code="timeout",
                    latency_ms=latency_ms,
                )
                quota_response = _quota_error_response(exc)
                if quota_response is not None:
                    return quota_response
                return JSONResponse(status_code=504, content={"error": {"message": exc.message, "type": "timeout"}})
        except httpx.RequestError as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            try:
                reservation = await fallback_model_route(
                    session,
                    request_id,
                    ModelFallbackRequest(
                        task_id=task_id,
                        attempt_no=reservation.attempt_no,
                        estimated_tokens=estimated_total,
                        estimated_input_tokens=estimated_input,
                        output_token_budget=estimated_total - estimated_input,
                        error_type="server_error",
                        error_code="connection_error",
                        latency_ms=latency_ms,
                        environment=environment,
                    ),
                )
                continue
            except DagentError as fallback_exc:
                await fail_model_route(
                    session,
                    request_id,
                    task_id=task_id,
                    attempt_no=reservation.attempt_no,
                    error_type="server_error",
                    error_code="connection_error",
                    latency_ms=latency_ms,
                )
                quota_response = _quota_error_response(fallback_exc)
                if quota_response is not None:
                    return quota_response
                return JSONResponse(
                    status_code=502,
                    content={"error": {"message": str(exc), "type": "upstream"}},
                )
