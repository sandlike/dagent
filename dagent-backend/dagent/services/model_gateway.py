from __future__ import annotations

import os
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import cast
from urllib.parse import urljoin

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from dagent.api.errors import InvalidStateError, NotFoundError
from dagent.api.schemas.model_gateway import (
    DetectedApiProtocol,
    ModelFallbackRequest,
    ModelReservationRead,
    ModelReservationRequest,
    ModelRouteRead,
    ModelRouteTestResult,
    ModelSettlementRequest,
)
from dagent.models import (
    AgentTask,
    ModelCallLog,
    ModelQuotaLedger,
    ModelRoute,
    Requirement,
    User,
    UserAgentModelBinding,
    UserModelQuota,
    UserModelRoute,
)
from dagent.services.credentials import decrypt_model_token
from dagent.services.redaction import redact_sensitive_text

AGENT_MODEL_TYPES = ("requirement_clarification", "development")
DEFAULT_USER_QUOTA = 50_000
ALL_MODEL_NODES_QUOTA_EXHAUSTED = "所有模型节点额度不足"
USER_TOTAL_BUDGET_EXHAUSTED = "用户总预算不足"


class UserBudgetExceeded(RuntimeError):
    pass


def _model_response_text(body: object) -> str:
    if not isinstance(body, dict):
        raise ValueError("Model returned a non-object response")
    choices = body.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("Model returned no choices")
    for choice in choices:
        if not isinstance(choice, dict):
            continue
        message = choice.get("message")
        content = message.get("content") if isinstance(message, dict) else None
        if isinstance(content, str) and content.strip():
            return content.strip()
        if isinstance(content, list):
            blocks = [
                str(block.get("text") or "").strip()
                for block in content
                if isinstance(block, dict) and str(block.get("text") or "").strip()
            ]
            if blocks:
                return "\n".join(blocks)
        text = choice.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()
    raise ValueError("Model returned an empty response")


def _responses_response_text(body: object) -> str:
    if not isinstance(body, dict):
        raise ValueError("Responses API returned a non-object response")
    output = body.get("output")
    if not isinstance(output, list):
        raise ValueError("Responses API returned no output")
    text_parts: list[str] = []
    for item in output:
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if isinstance(block, dict) and block.get("type") in {"output_text", "text"}:
                text = block.get("text")
                if isinstance(text, str) and text.strip():
                    text_parts.append(text.strip())
    if not text_parts:
        raise ValueError("Responses API returned an empty response")
    return "\n".join(text_parts)


def configured_api_protocol(route: object) -> str:
    configured = getattr(route, "api_protocol", None) or "auto"
    if configured == "auto":
        return getattr(route, "detected_api_protocol", None) or "chat_completions"
    return configured


def resolve_model_credential(reference: str | None, ciphertext: str | None = None) -> str | None:
    if ciphertext:
        return decrypt_model_token(ciphertext)
    if reference is None:
        return None
    if not reference.startswith("env://"):
        raise ValueError("Only env:// credential references are supported")
    env_name = reference.removeprefix("env://").strip()
    if not env_name:
        raise ValueError("Credential environment variable name is empty")
    value = os.getenv(env_name)
    if not value:
        raise ValueError(f"Credential environment variable {env_name} is not configured")
    return value


async def probe_model_route(route: ModelRoute) -> ModelRouteTestResult:
    started_at = time.perf_counter()
    api_key: str | None = None
    try:
        api_key = resolve_model_credential(route.credential_ref, route.credential_ciphertext)
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        timeout = min(route.timeout_ms / 1000, 30)
        models_url = urljoin(route.base_url.rstrip("/") + "/", "models")
        configured_protocol = getattr(route, "api_protocol", None) or "auto"
        protocols = (
            [configured_protocol]
            if configured_protocol != "auto"
            else ["chat_completions", "responses"]
        )
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            models_response = await client.get(models_url, headers=headers)
            samples: list[str] = []
            if 200 <= models_response.status_code < 300:
                try:
                    models_body = models_response.json()
                except ValueError:
                    models_body = {}
                raw_models = models_body.get("data", []) if isinstance(models_body, dict) else []
                if isinstance(raw_models, list):
                    samples = [
                        str(item.get("id"))
                        for item in raw_models[:5]
                        if isinstance(item, dict) and item.get("id")
                    ]
            failures: list[str] = []
            response_text = ""
            detected_protocol: str | None = None
            for protocol in protocols:
                endpoint_name = "chat/completions" if protocol == "chat_completions" else "responses"
                endpoint_url = urljoin(route.base_url.rstrip("/") + "/", endpoint_name)
                request_payload: dict[str, object]
                if protocol == "responses":
                    request_payload = {
                        "model": route.model,
                        "input": "Reply with exactly: OK",
                        "max_output_tokens": 256,
                        "stream": False,
                    }
                else:
                    request_payload = {
                        "model": route.model,
                        "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
                        "max_tokens": 256,
                        "stream": False,
                    }
                response = await client.post(endpoint_url, headers=headers, json=request_payload)
                try:
                    response.raise_for_status()
                    body = response.json()
                    response_text = (
                        _responses_response_text(body)
                        if protocol == "responses"
                        else _model_response_text(body)
                    )
                except httpx.HTTPError:
                    status = getattr(response, "status_code", "unknown")
                    failures.append(f"{endpoint_name}: HTTP {status}")
                    continue
                except (TypeError, ValueError) as exc:
                    content_type = getattr(response, "headers", {}).get("content-type", "unknown")
                    status = getattr(response, "status_code", "unknown")
                    failures.append(
                        f"{endpoint_name}: {str(exc)} (HTTP {status}, content-type {content_type})"
                    )
                    continue
                detected_protocol = protocol
                break
            if detected_protocol is None:
                raise ValueError("No supported model API protocol detected: " + "; ".join(failures))
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        return ModelRouteTestResult(
            ok=True,
            latency_ms=latency_ms,
            health_status="healthy",
            sample_models=samples,
            response_preview=redact_sensitive_text(response_text, (api_key or "",))[:200],
            detected_api_protocol=cast(DetectedApiProtocol, detected_protocol),
            message=f"Model gateway response succeeded using {detected_protocol}",
        )
    except (ValueError, httpx.HTTPError, TypeError) as exc:
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        return ModelRouteTestResult(
            ok=False,
            latency_ms=latency_ms,
            health_status="unhealthy",
            message=redact_sensitive_text(str(exc), (api_key or "",))[:2000],
        )


def agent_scope_for_task(task_type: str) -> str:
    if task_type == "clarification_generate":
        return "requirement_clarification"
    return "development"


async def ensure_user_model_profile(
    session: AsyncSession,
    *,
    tenant_id: int,
    user_id: int,
) -> tuple[UserModelQuota, list[ModelRoute], list[UserAgentModelBinding]]:
    owner_id = await session.scalar(
        select(User.id)
        .where(User.id == user_id, User.tenant_id == tenant_id, User.status == "active")
        .with_for_update()
    )
    if owner_id is None:
        raise NotFoundError("User does not exist")
    quota = await session.scalar(
        select(UserModelQuota).where(
            UserModelQuota.tenant_id == tenant_id,
            UserModelQuota.user_id == user_id,
        )
    )
    if quota is None:
        quota = UserModelQuota(
            tenant_id=tenant_id,
            user_id=user_id,
            quota_limit=DEFAULT_USER_QUOTA,
            reset_at=datetime.now(UTC) + timedelta(days=30),
            hard_limit_enabled=False,
            auto_fallback=True,
        )
        session.add(quota)
        await session.flush()

    routes = list(
        (
            await session.scalars(
                select(ModelRoute)
                .where(ModelRoute.tenant_id == tenant_id, ModelRoute.status == "active")
                .order_by(ModelRoute.priority, ModelRoute.id)
            )
        ).all()
    )

    reset_at = quota.reset_at
    if reset_at is not None and reset_at.tzinfo is None:
        reset_at = reset_at.replace(tzinfo=UTC)
    if reset_at is not None and reset_at <= datetime.now(UTC) and quota.quota_reserved == 0:
        quota.quota_used = 0
        quota.reset_at = datetime.now(UTC) + timedelta(days=30)
        quota.version += 1
    legacy_routes = list(
        (
            await session.scalars(
                select(UserModelRoute).where(
                    UserModelRoute.tenant_id == tenant_id,
                    UserModelRoute.user_id == user_id,
                )
            )
        ).all()
    )
    legacy_route_map = {route.id: route.model_route_id for route in legacy_routes}
    route_ids = {route.id for route in routes}

    def route_ids_for_agent(agent_type: str) -> list[int]:
        return [
            route.id
            for route in routes
            if not route.agent_types or agent_type in route.agent_types
        ]

    bindings = list(
        (
            await session.scalars(
                select(UserAgentModelBinding).where(
                    UserAgentModelBinding.tenant_id == tenant_id,
                    UserAgentModelBinding.user_id == user_id,
                    UserAgentModelBinding.agent_type.in_(AGENT_MODEL_TYPES),
                )
            )
        ).all()
    )
    bindings_by_type = {binding.agent_type: binding for binding in bindings}
    for agent_type in AGENT_MODEL_TYPES:
        allowed_route_ids = route_ids_for_agent(agent_type)
        if agent_type in bindings_by_type:
            binding = bindings_by_type[agent_type]
            migrated_route_ids = [legacy_route_map.get(route_id, route_id) for route_id in binding.route_ids]
            normalized_route_ids = [
                route_id
                for route_id in migrated_route_ids
                if route_id in allowed_route_ids and route_id in route_ids
            ]
            normalized_route_ids = list(dict.fromkeys(normalized_route_ids))
            if normalized_route_ids != binding.route_ids:
                binding.route_ids = normalized_route_ids
                binding.version += 1
            continue
        binding = UserAgentModelBinding(
            tenant_id=tenant_id,
            user_id=user_id,
            agent_type=agent_type,
            route_ids=allowed_route_ids,
        )
        session.add(binding)
        bindings.append(binding)
    await session.flush()
    bindings.sort(key=lambda item: AGENT_MODEL_TYPES.index(item.agent_type))
    routes.sort(key=lambda item: (item.priority, item.id))
    return quota, routes, bindings


async def _task_context(
    session: AsyncSession, task_id: int
) -> tuple[AgentTask, Requirement, int, str]:
    row = (
        await session.execute(
            select(AgentTask, Requirement)
            .join(Requirement, Requirement.id == AgentTask.requirement_id)
            .where(AgentTask.id == task_id)
        )
    ).one_or_none()
    if row is None:
        raise NotFoundError("Agent task does not exist")
    task, requirement = row[0], row[1]
    user_id = task.requested_by or requirement.created_by
    return task, requirement, user_id, agent_scope_for_task(task.task_type)


async def _candidate_routes(
    session: AsyncSession,
    *,
    tenant_id: int,
    user_id: int,
    agent_type: str,
    environment: str,
    excluded_route_ids: set[int],
) -> tuple[UserModelQuota, list[ModelRoute]]:
    quota, routes, bindings = await ensure_user_model_profile(
        session,
        tenant_id=tenant_id,
        user_id=user_id,
    )
    binding = next((item for item in bindings if item.agent_type == agent_type), None)
    ordered_ids = binding.route_ids if binding is not None else [route.id for route in routes]
    if not quota.auto_fallback:
        ordered_ids = ordered_ids[:1]
    routes_by_id = {route.id: route for route in routes}
    candidates = [
        routes_by_id[route_id]
        for route_id in ordered_ids
        if route_id in routes_by_id
        and route_id not in excluded_route_ids
        and routes_by_id[route_id].status == "active"
        and routes_by_id[route_id].health_status != "unhealthy"
        and (
            not routes_by_id[route_id].agent_types
            or agent_type in routes_by_id[route_id].agent_types
        )
        and (
            not routes_by_id[route_id].environments
            or environment in routes_by_id[route_id].environments
        )
    ]
    return quota, candidates


async def _reserve_candidate(
    session: AsyncSession,
    *,
    quota: UserModelQuota,
    route: ModelRoute,
    user_id: int,
    agent_type: str,
    task: AgentTask,
    requirement: Requirement,
    request_id: str,
    attempt_no: int,
    estimated_tokens: int,
    estimated_input_tokens: int,
    output_token_budget: int,
    fallback_from_route_id: int | None,
    fallback_reason: str | None,
    trace_id: str,
) -> ModelReservationRead | None:
    result = await session.execute(
        update(ModelRoute)
        .where(
            ModelRoute.id == route.id,
            ModelRoute.tenant_id == task.tenant_id,
            ModelRoute.status == "active",
            ModelRoute.quota_used + ModelRoute.quota_reserved + estimated_tokens
            <= ModelRoute.quota_limit,
        )
        .values(quota_reserved=ModelRoute.quota_reserved + estimated_tokens)
    )
    if getattr(result, "rowcount", 0) != 1:
        return None
    quota_update = update(UserModelQuota).where(
        UserModelQuota.id == quota.id,
        UserModelQuota.user_id == user_id,
    )
    if quota.hard_limit_enabled:
        quota_update = quota_update.where(
            UserModelQuota.quota_used + UserModelQuota.quota_reserved + estimated_tokens
            <= UserModelQuota.quota_limit,
        )
    quota_result = await session.execute(
        quota_update.values(quota_reserved=UserModelQuota.quota_reserved + estimated_tokens)
    )
    if getattr(quota_result, "rowcount", 0) != 1:
        await session.execute(
            update(ModelRoute)
            .where(ModelRoute.id == route.id)
            .values(quota_reserved=ModelRoute.quota_reserved - estimated_tokens)
        )
        raise UserBudgetExceeded

    ledger = ModelQuotaLedger(
        tenant_id=task.tenant_id,
        user_id=user_id,
        route_id=route.id,
        task_id=task.id,
        request_id=request_id,
        attempt_no=attempt_no,
        reserved_tokens=estimated_tokens,
        status="reserved",
    )
    session.add(ledger)
    session.add(
        ModelCallLog(
            tenant_id=task.tenant_id,
            user_id=user_id,
            agent_type=agent_type,
            route_id=route.id,
            task_id=task.id,
            project_id=requirement.project_id,
            requirement_id=requirement.id,
            request_id=request_id,
            trace_id=trace_id,
            attempt_no=attempt_no,
            status="reserved",
            estimated_input_tokens=estimated_input_tokens,
            output_token_budget=output_token_budget,
            reserved_tokens=estimated_tokens,
            fallback_from_route_id=fallback_from_route_id,
            fallback_reason=fallback_reason,
        )
    )
    await session.flush()
    await session.refresh(route)
    return ModelReservationRead(
        request_id=request_id,
        attempt_no=attempt_no,
        reserved_tokens=estimated_tokens,
        route=ModelRouteRead.model_validate(route),
    )


async def reserve_model_route(
    session: AsyncSession, payload: ModelReservationRequest
) -> ModelReservationRead:
    task, requirement, user_id, agent_type = await _task_context(session, payload.task_id)
    existing = await session.scalar(
        select(ModelQuotaLedger).where(
            ModelQuotaLedger.tenant_id == task.tenant_id,
            ModelQuotaLedger.request_id == payload.request_id,
            ModelQuotaLedger.attempt_no == 1,
        )
    )
    if existing is not None:
        route = await session.get(ModelRoute, existing.route_id)
        if route is None:
            raise NotFoundError("Reserved model route no longer exists")
        return ModelReservationRead(
            request_id=existing.request_id,
            attempt_no=existing.attempt_no,
            reserved_tokens=existing.reserved_tokens,
            route=ModelRouteRead.model_validate(route),
        )

    quota, candidates = await _candidate_routes(
        session,
        tenant_id=task.tenant_id,
        user_id=user_id,
        agent_type=agent_type,
        environment=payload.environment,
        excluded_route_ids=set(),
    )
    trace_id = uuid.uuid4().hex
    fallback_from_route_id: int | None = None
    for route in candidates:
        try:
            reservation = await _reserve_candidate(
                session,
                quota=quota,
                route=route,
                user_id=user_id,
                agent_type=agent_type,
                task=task,
                requirement=requirement,
                request_id=payload.request_id,
                attempt_no=1,
                estimated_tokens=payload.estimated_tokens,
                estimated_input_tokens=payload.estimated_input_tokens,
                output_token_budget=payload.output_token_budget,
                fallback_from_route_id=fallback_from_route_id,
                fallback_reason=("quota_exhausted" if fallback_from_route_id is not None else None),
                trace_id=trace_id,
            )
        except UserBudgetExceeded:
            await session.rollback()
            raise InvalidStateError(USER_TOTAL_BUDGET_EXHAUSTED) from None
        if reservation is not None:
            await session.commit()
            return reservation
        fallback_from_route_id = route.id
    await session.rollback()
    raise InvalidStateError(ALL_MODEL_NODES_QUOTA_EXHAUSTED)


async def fallback_model_route(
    session: AsyncSession,
    request_id: str,
    payload: ModelFallbackRequest,
) -> ModelReservationRead:
    task, requirement, user_id, agent_type = await _task_context(session, payload.task_id)
    previous = await session.scalar(
        select(ModelQuotaLedger).where(
            ModelQuotaLedger.tenant_id == task.tenant_id,
            ModelQuotaLedger.request_id == request_id,
            ModelQuotaLedger.attempt_no == payload.attempt_no,
        )
    )
    if previous is None:
        raise NotFoundError("Model reservation does not exist")
    if payload.attempt_no >= 2:
        raise InvalidStateError("Model fallback limit reached")
    next_attempt = payload.attempt_no + 1
    existing_next = await session.scalar(
        select(ModelQuotaLedger).where(
            ModelQuotaLedger.tenant_id == task.tenant_id,
            ModelQuotaLedger.request_id == request_id,
            ModelQuotaLedger.attempt_no == next_attempt,
        )
    )
    if existing_next is not None:
        route = await session.get(ModelRoute, existing_next.route_id)
        if route is None:
            raise NotFoundError("Fallback model route no longer exists")
        return ModelReservationRead(
            request_id=request_id,
            attempt_no=next_attempt,
            reserved_tokens=existing_next.reserved_tokens,
            route=ModelRouteRead.model_validate(route),
        )
    if previous.status != "reserved":
        raise InvalidStateError("Only a reserved model attempt can fall back")
    previous_route = await session.get(ModelRoute, previous.route_id)
    if previous_route is None:
        raise NotFoundError("Reserved model route no longer exists")
    required_fallback_errors = {
        "timeout",
        "server_error",
        "rate_limited",
        "authentication_error",
    }
    if (
        payload.error_type not in required_fallback_errors
        and payload.error_type not in previous_route.fallback_on
    ):
        raise InvalidStateError(f"Fallback is not allowed for {payload.error_type}")

    await session.execute(
        update(ModelRoute)
        .where(ModelRoute.id == previous.route_id)
        .values(quota_reserved=ModelRoute.quota_reserved - previous.reserved_tokens)
    )
    await session.execute(
        update(UserModelQuota)
        .where(
            UserModelQuota.tenant_id == task.tenant_id,
            UserModelQuota.user_id == user_id,
        )
        .values(quota_reserved=UserModelQuota.quota_reserved - previous.reserved_tokens)
    )
    previous.status = "failed"
    previous.released_tokens = previous.reserved_tokens
    previous.settled_at = datetime.now(UTC)
    previous_log = await session.scalar(
        select(ModelCallLog).where(
            ModelCallLog.tenant_id == task.tenant_id,
            ModelCallLog.request_id == request_id,
            ModelCallLog.attempt_no == payload.attempt_no,
        )
    )
    if previous_log is not None:
        previous_log.status = "failed"
        previous_log.error_type = payload.error_type
        previous_log.error_code = payload.error_code
        previous_log.latency_ms = payload.latency_ms
        previous_log.released_tokens = previous.reserved_tokens

    attempted_route_ids = set(
        (
            await session.scalars(
                select(ModelQuotaLedger.route_id).where(
                    ModelQuotaLedger.tenant_id == task.tenant_id,
                    ModelQuotaLedger.request_id == request_id,
                )
            )
        ).all()
    )
    quota, candidates = await _candidate_routes(
        session,
        tenant_id=task.tenant_id,
        user_id=user_id,
        agent_type=agent_type,
        environment=payload.environment,
        excluded_route_ids={route_id for route_id in attempted_route_ids if route_id is not None},
    )
    for route in candidates:
        try:
            reservation = await _reserve_candidate(
                session,
                quota=quota,
                route=route,
                user_id=user_id,
                agent_type=agent_type,
                task=task,
                requirement=requirement,
                request_id=request_id,
                attempt_no=next_attempt,
                estimated_tokens=payload.estimated_tokens,
                estimated_input_tokens=payload.estimated_input_tokens,
                output_token_budget=payload.output_token_budget,
                fallback_from_route_id=previous.route_id,
                fallback_reason=payload.error_type,
                trace_id=previous_log.trace_id if previous_log is not None else uuid.uuid4().hex,
            )
        except UserBudgetExceeded:
            await session.commit()
            raise InvalidStateError(USER_TOTAL_BUDGET_EXHAUSTED) from None
        if reservation is not None:
            await session.commit()
            return reservation
    await session.commit()
    raise InvalidStateError(ALL_MODEL_NODES_QUOTA_EXHAUSTED)


async def fail_model_route(
    session: AsyncSession,
    request_id: str,
    *,
    task_id: int,
    attempt_no: int,
    error_type: str,
    error_code: str | None,
    latency_ms: int,
) -> None:
    task, _, _, _ = await _task_context(session, task_id)
    ledger = await session.scalar(
        select(ModelQuotaLedger).where(
            ModelQuotaLedger.tenant_id == task.tenant_id,
            ModelQuotaLedger.request_id == request_id,
            ModelQuotaLedger.attempt_no == attempt_no,
        )
    )
    if ledger is None or ledger.status != "reserved":
        return
    await session.execute(
        update(ModelRoute)
        .where(ModelRoute.id == ledger.route_id)
        .values(quota_reserved=ModelRoute.quota_reserved - ledger.reserved_tokens)
    )
    if ledger.user_id is not None:
        await session.execute(
            update(UserModelQuota)
            .where(UserModelQuota.tenant_id == task.tenant_id, UserModelQuota.user_id == ledger.user_id)
            .values(quota_reserved=UserModelQuota.quota_reserved - ledger.reserved_tokens)
        )
    ledger.status = "failed"
    ledger.released_tokens = ledger.reserved_tokens
    ledger.settled_at = datetime.now(UTC)
    call_log = await session.scalar(
        select(ModelCallLog).where(
            ModelCallLog.tenant_id == task.tenant_id,
            ModelCallLog.request_id == request_id,
            ModelCallLog.attempt_no == attempt_no,
        )
    )
    if call_log is not None:
        call_log.status = "failed"
        call_log.error_type = error_type
        call_log.error_code = error_code
        call_log.latency_ms = latency_ms
        call_log.released_tokens = ledger.reserved_tokens
    await session.commit()


async def settle_model_route(
    session: AsyncSession,
    request_id: str,
    payload: ModelSettlementRequest,
) -> None:
    task, _, _, _ = await _task_context(session, payload.task_id)
    ledger = await session.scalar(
        select(ModelQuotaLedger).where(
            ModelQuotaLedger.tenant_id == task.tenant_id,
            ModelQuotaLedger.request_id == request_id,
            ModelQuotaLedger.attempt_no == payload.attempt_no,
        )
    )
    if ledger is None:
        raise NotFoundError("Model reservation does not exist")
    if ledger.status == "settled":
        return
    if ledger.status != "reserved":
        raise InvalidStateError("Only a reserved model attempt can be settled")
    actual_tokens = payload.input_tokens + payload.output_tokens
    if actual_tokens > ledger.reserved_tokens:
        raise InvalidStateError("Actual token usage exceeds the reservation")
    released_tokens = ledger.reserved_tokens - actual_tokens
    await session.execute(
        update(ModelRoute)
        .where(ModelRoute.id == ledger.route_id)
        .values(
            quota_reserved=ModelRoute.quota_reserved - ledger.reserved_tokens,
            quota_used=ModelRoute.quota_used + actual_tokens,
            last_called_at=datetime.now(UTC),
        )
    )
    if ledger.user_id is not None:
        await session.execute(
            update(UserModelQuota)
            .where(UserModelQuota.tenant_id == task.tenant_id, UserModelQuota.user_id == ledger.user_id)
            .values(
                quota_reserved=UserModelQuota.quota_reserved - ledger.reserved_tokens,
                quota_used=UserModelQuota.quota_used + actual_tokens,
            )
        )
    ledger.input_tokens = payload.input_tokens
    ledger.output_tokens = payload.output_tokens
    ledger.released_tokens = released_tokens
    ledger.status = "settled"
    ledger.usage_estimated = payload.usage_estimated
    ledger.settled_at = datetime.now(UTC)
    call_log = await session.scalar(
        select(ModelCallLog).where(
            ModelCallLog.tenant_id == task.tenant_id,
            ModelCallLog.request_id == request_id,
            ModelCallLog.attempt_no == payload.attempt_no,
        )
    )
    if call_log is not None:
        call_log.status = "succeeded"
        call_log.latency_ms = payload.latency_ms
        call_log.input_tokens = payload.input_tokens
        call_log.output_tokens = payload.output_tokens
        call_log.released_tokens = released_tokens
        call_log.usage_estimated = payload.usage_estimated
    await session.commit()
