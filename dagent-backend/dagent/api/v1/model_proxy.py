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
        started = time.perf_counter()
        credential = resolve_model_credential(route.credential_ref)
        headers = {"Authorization": f"Bearer {credential}"} if credential else {}
        try:
            async with httpx.AsyncClient(timeout=route.timeout_ms / 1000, follow_redirects=False) as client:
                upstream = await client.post(
                    urljoin(route.base_url.rstrip("/") + "/", "chat/completions"),
                    json=clean_payload,
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
            content_type = upstream.headers.get("content-type", "application/json")
            input_tokens, output_tokens, estimated = _usage(
                upstream.content,
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
            return Response(content=upstream.content, status_code=upstream.status_code, media_type=content_type)
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
