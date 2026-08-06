from __future__ import annotations

from typing import cast

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from dagent.api.deps import CurrentUser, SessionDep, TraceId, require_roles
from dagent.api.errors import ConflictError, InvalidStateError, NotFoundError
from dagent.api.schemas.common import ApiResponse, Page
from dagent.api.schemas.model_gateway import (
    AgentModelRouteRead,
    AgentModelType,
    ApiProtocol,
    DetectedApiProtocol,
    HealthStatus,
    RouteStatus,
    UserAgentModelBindingRead,
    UserAgentModelBindingUpdate,
    UserModelCallLogRead,
    UserModelGatewayRead,
    UserModelGatewaySettingsUpdate,
    UserModelQuotaAdminUpdate,
    UserModelQuotaRead,
)
from dagent.models import (
    ModelCallLog,
    ModelRoute,
    User,
    UserModelQuota,
)
from dagent.services.audit import add_audit_log
from dagent.services.model_gateway import ensure_user_model_profile

router = APIRouter()
admin_user = Depends(require_roles("admin"))


def _quota_read(quota: UserModelQuota) -> UserModelQuotaRead:
    return UserModelQuotaRead(
        quota_limit=quota.quota_limit,
        quota_reserved=quota.quota_reserved,
        quota_used=quota.quota_used,
        quota_remaining=(
            max(0, quota.quota_limit - quota.quota_reserved - quota.quota_used)
            if quota.hard_limit_enabled
            else None
        ),
        reset_at=quota.reset_at,
        hard_limit_enabled=quota.hard_limit_enabled,
        auto_fallback=quota.auto_fallback,
        resource_version=quota.version,
    )


def _route_read(
    route: ModelRoute,
    call_count: int = 0,
) -> AgentModelRouteRead:
    return AgentModelRouteRead(
        id=route.id,
        name=route.name,
        provider=route.provider,
        model=route.model,
        api_protocol=cast(ApiProtocol, route.api_protocol or "auto"),
        detected_api_protocol=cast(DetectedApiProtocol | None, route.detected_api_protocol),
        priority=route.priority,
        agent_types=list(route.agent_types),
        quota_limit=route.quota_limit,
        quota_reserved=route.quota_reserved,
        quota_used=route.quota_used,
        quota_remaining=max(0, route.quota_limit - route.quota_reserved - route.quota_used),
        call_count=call_count,
        status=cast(RouteStatus, route.status),
        health_status=cast(HealthStatus, route.health_status),
        fallback_on=route.fallback_on,
        credential_configured=bool(
            route.credential_ref or route.credential_ciphertext
        ),
        last_checked_at=route.last_checked_at,
        last_called_at=route.last_called_at,
        resource_version=route.version,
    )


async def _gateway_read(session: SessionDep, user: User) -> UserModelGatewayRead:
    quota, routes, bindings = await ensure_user_model_profile(
        session,
        tenant_id=user.tenant_id,
        user_id=user.id,
    )
    call_count_rows = (
        await session.execute(
            select(ModelCallLog.route_id, func.count(ModelCallLog.id))
            .where(ModelCallLog.user_id == user.id)
            .group_by(ModelCallLog.route_id)
        )
    ).all()
    call_counts: dict[int, int] = {
        route_id: int(count) for route_id, count in call_count_rows if route_id is not None
    }
    await session.commit()
    return UserModelGatewayRead(
        quota=_quota_read(quota),
        routes=[
            _route_read(route, int(call_counts.get(route.id, 0)))
            for route in routes
        ],
        bindings=[
            UserAgentModelBindingRead(
                agent_type=cast(AgentModelType, binding.agent_type),
                route_ids=binding.route_ids,
                resource_version=binding.version,
            )
            for binding in bindings
        ],
    )


@router.get("/me/model-gateway", response_model=ApiResponse[UserModelGatewayRead])
async def my_model_gateway(user: CurrentUser, session: SessionDep) -> ApiResponse[UserModelGatewayRead]:
    return ApiResponse(data=await _gateway_read(session, user))


@router.put(
    "/me/agent-model-bindings/{agent_type}",
    response_model=ApiResponse[UserAgentModelBindingRead],
)
async def update_my_agent_model_binding(
    agent_type: AgentModelType,
    payload: UserAgentModelBindingUpdate,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[UserAgentModelBindingRead]:
    _, _, bindings = await ensure_user_model_profile(
        session,
        tenant_id=user.tenant_id,
        user_id=user.id,
    )
    requested_route_ids = set(payload.route_ids)
    scoped_rows = (
        await session.execute(
            select(ModelRoute.id, ModelRoute.agent_types)
            .where(
                ModelRoute.id.in_(requested_route_ids),
                ModelRoute.tenant_id == user.tenant_id,
                ModelRoute.status == "active",
            )
        )
    ).all()
    scoped_route_ids = {
        route_id
        for route_id, assigned_agent_types in scoped_rows
        if not assigned_agent_types or agent_type in assigned_agent_types
    }
    if requested_route_ids != scoped_route_ids:
        raise InvalidStateError(
            "Agent bindings can only contain active routes assigned to this Agent type"
        )
    binding = next(item for item in bindings if item.agent_type == agent_type)
    if binding.version != payload.resource_version:
        raise ConflictError("Agent model binding resource version is stale")
    binding.route_ids = payload.route_ids
    binding.version += 1
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="user_agent_model_binding.update",
        resource_type="user_agent_model_binding",
        resource_id=binding.id,
        trace_id=trace_id,
        details={"agent_type": agent_type, "route_ids": payload.route_ids},
    )
    await session.commit()
    await session.refresh(binding)
    return ApiResponse(
        data=UserAgentModelBindingRead(
            agent_type=agent_type,
            route_ids=binding.route_ids,
            resource_version=binding.version,
        )
    )


@router.put("/me/model-gateway/settings", response_model=ApiResponse[UserModelQuotaRead])
async def update_my_model_gateway_settings(
    payload: UserModelGatewaySettingsUpdate,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[UserModelQuotaRead]:
    quota, _, _ = await ensure_user_model_profile(session, tenant_id=user.tenant_id, user_id=user.id)
    if quota.version != payload.resource_version:
        raise ConflictError("User model quota resource version is stale")
    quota.auto_fallback = payload.auto_fallback
    quota.version += 1
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="user_model_gateway.settings_update",
        resource_type="user_model_quota",
        resource_id=quota.id,
        trace_id=trace_id,
        details={"auto_fallback": quota.auto_fallback},
    )
    await session.commit()
    await session.refresh(quota)
    return ApiResponse(data=_quota_read(quota))


@router.get("/me/model-call-logs", response_model=ApiResponse[Page[UserModelCallLogRead]])
async def my_model_call_logs(
    user: CurrentUser,
    session: SessionDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    route_id: int | None = None,
) -> ApiResponse[Page[UserModelCallLogRead]]:
    filters = [ModelCallLog.tenant_id == user.tenant_id, ModelCallLog.user_id == user.id]
    if route_id is not None:
        filters.append(ModelCallLog.route_id == route_id)
    total = await session.scalar(select(func.count(ModelCallLog.id)).where(*filters)) or 0
    rows = list(
        (
            await session.execute(
                select(ModelCallLog, ModelRoute)
                .join(ModelRoute, ModelRoute.id == ModelCallLog.route_id)
                .where(*filters)
                .order_by(ModelCallLog.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return ApiResponse(
        data=Page(
            items=[
                UserModelCallLogRead(
                    id=log.id,
                    user_id=user.id,
                    agent_type=log.agent_type or "unknown",
                    route_id=platform_route.id,
                    route_name=platform_route.name,
                    model=platform_route.model,
                    task_id=log.task_id,
                    project_id=log.project_id,
                    requirement_id=log.requirement_id,
                    request_id=log.request_id,
                    trace_id=log.trace_id,
                    attempt_no=log.attempt_no,
                    status=log.status,
                    error_type=log.error_type,
                    error_code=log.error_code,
                    latency_ms=log.latency_ms,
                    input_tokens=log.input_tokens,
                    output_tokens=log.output_tokens,
                    estimated_input_tokens=log.estimated_input_tokens,
                    output_token_budget=log.output_token_budget,
                    reserved_tokens=log.reserved_tokens,
                    released_tokens=log.released_tokens,
                    usage_estimated=log.usage_estimated,
                    fallback_from_route_id=log.fallback_from_route_id,
                    fallback_reason=log.fallback_reason,
                    created_at=log.created_at,
                )
                for log, platform_route in rows
            ],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.put("/users/{user_id}/model-quota", response_model=ApiResponse[UserModelQuotaRead])
async def update_user_model_quota(
    user_id: int,
    payload: UserModelQuotaAdminUpdate,
    session: SessionDep,
    trace_id: TraceId,
    actor: User = admin_user,
) -> ApiResponse[UserModelQuotaRead]:
    target = await session.scalar(
        select(User).where(User.id == user_id, User.tenant_id == actor.tenant_id, User.status == "active")
    )
    if target is None:
        raise NotFoundError("User does not exist")
    quota, _, _ = await ensure_user_model_profile(session, tenant_id=actor.tenant_id, user_id=target.id)
    if quota.version != payload.resource_version:
        raise ConflictError("User model quota resource version is stale")
    hard_limit_enabled = (
        payload.hard_limit_enabled
        if payload.hard_limit_enabled is not None
        else quota.hard_limit_enabled
    )
    if hard_limit_enabled and payload.quota_limit < quota.quota_used + quota.quota_reserved:
        raise InvalidStateError("Quota cannot be lower than current usage")
    quota.quota_limit = payload.quota_limit
    quota.hard_limit_enabled = hard_limit_enabled
    quota.reset_at = payload.reset_at
    quota.version += 1
    add_audit_log(
        session,
        tenant_id=actor.tenant_id,
        actor_id=actor.id,
        action="user_model_quota.update",
        resource_type="user",
        resource_id=target.id,
        trace_id=trace_id,
        details={
            "quota_limit": quota.quota_limit,
            "hard_limit_enabled": quota.hard_limit_enabled,
            "reset_at": str(quota.reset_at),
        },
    )
    await session.commit()
    await session.refresh(quota)
    return ApiResponse(data=_quota_read(quota))
