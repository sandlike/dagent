from __future__ import annotations

from datetime import UTC, datetime
from typing import cast

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from dagent.api.deps import CurrentUser, SessionDep, TraceId, require_roles
from dagent.api.errors import ConflictError, InvalidStateError, NotFoundError
from dagent.api.schemas.common import ApiResponse, Page
from dagent.api.schemas.model_gateway import (
    AgentModelType,
    HealthStatus,
    ModelCatalogItem,
    ModelLevel,
    ModelRouteTestResult,
    RouteStatus,
    UserAgentModelBindingRead,
    UserAgentModelBindingUpdate,
    UserModelCallLogRead,
    UserModelGatewayRead,
    UserModelGatewaySettingsUpdate,
    UserModelQuotaAdminUpdate,
    UserModelQuotaRead,
    UserModelRouteCreate,
    UserModelRouteRead,
    UserModelRouteUpdate,
)
from dagent.models import (
    ModelCallLog,
    ModelRoute,
    User,
    UserModelQuota,
    UserModelRoute,
)
from dagent.services.audit import add_audit_log
from dagent.services.model_gateway import ensure_user_model_profile, probe_model_route

router = APIRouter()
admin_user = Depends(require_roles("admin"))


async def _user_route_or_404(
    session: SessionDep,
    user: User,
    user_route_id: int,
) -> tuple[UserModelRoute, ModelRoute]:
    row = (
        await session.execute(
            select(UserModelRoute, ModelRoute)
            .join(ModelRoute, ModelRoute.id == UserModelRoute.model_route_id)
            .where(
                UserModelRoute.id == user_route_id,
                UserModelRoute.tenant_id == user.tenant_id,
                UserModelRoute.user_id == user.id,
            )
        )
    ).one_or_none()
    if row is None:
        raise NotFoundError("User model route does not exist")
    return row[0], row[1]


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
    user_route: UserModelRoute,
    platform_route: ModelRoute,
    call_count: int = 0,
) -> UserModelRouteRead:
    return UserModelRouteRead(
        id=user_route.id,
        platform_route_id=platform_route.id,
        name=user_route.name,
        level=cast(ModelLevel, user_route.level),
        provider=platform_route.provider,
        model=platform_route.model,
        priority=user_route.priority,
        quota_limit=user_route.quota_limit,
        quota_reserved=user_route.quota_reserved,
        quota_used=user_route.quota_used,
        quota_remaining=max(
            0,
            user_route.quota_limit - user_route.quota_reserved - user_route.quota_used,
        ),
        call_count=call_count,
        status=cast(RouteStatus, user_route.status),
        health_status=cast(HealthStatus, platform_route.health_status),
        fallback_on=platform_route.fallback_on,
        credential_configured=bool(platform_route.credential_ref),
        last_checked_at=platform_route.last_checked_at,
        last_called_at=platform_route.last_called_at,
        resource_version=user_route.version,
    )


async def _gateway_read(session: SessionDep, user: User) -> UserModelGatewayRead:
    quota, routes, bindings = await ensure_user_model_profile(
        session,
        tenant_id=user.tenant_id,
        user_id=user.id,
    )
    platform_route_ids = {route.model_route_id for route in routes}
    platform_routes = list(
        (
            await session.scalars(select(ModelRoute).where(ModelRoute.id.in_(platform_route_ids)))
        ).all()
    )
    platform_by_id = {route.id: route for route in platform_routes}
    call_count_rows = (
        await session.execute(
            select(ModelCallLog.user_route_id, func.count(ModelCallLog.id))
            .where(ModelCallLog.user_id == user.id, ModelCallLog.user_route_id.is_not(None))
            .group_by(ModelCallLog.user_route_id)
        )
    ).all()
    call_counts: dict[int, int] = {
        route_id: int(count) for route_id, count in call_count_rows if route_id is not None
    }
    await session.commit()
    return UserModelGatewayRead(
        quota=_quota_read(quota),
        routes=[
            _route_read(route, platform_by_id[route.model_route_id], int(call_counts.get(route.id, 0)))
            for route in routes
            if route.model_route_id in platform_by_id
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


@router.get("/me/model-catalog", response_model=ApiResponse[list[ModelCatalogItem]])
async def my_model_catalog(user: CurrentUser, session: SessionDep) -> ApiResponse[list[ModelCatalogItem]]:
    routes = list(
        (
            await session.scalars(
                select(ModelRoute)
                .where(ModelRoute.tenant_id == user.tenant_id, ModelRoute.status == "active")
                .order_by(ModelRoute.priority, ModelRoute.id)
            )
        ).all()
    )
    return ApiResponse(
        data=[
            ModelCatalogItem(
                id=route.id,
                name=route.name,
                provider=route.provider,
                model=route.model,
                health_status=cast(HealthStatus, route.health_status),
                credential_configured=bool(route.credential_ref),
            )
            for route in routes
        ]
    )


@router.post("/me/model-routes", response_model=ApiResponse[UserModelRouteRead], status_code=201)
async def create_my_model_route(
    payload: UserModelRouteCreate,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[UserModelRouteRead]:
    await ensure_user_model_profile(session, tenant_id=user.tenant_id, user_id=user.id)
    platform_route = await session.scalar(
        select(ModelRoute).where(
            ModelRoute.id == payload.platform_route_id,
            ModelRoute.tenant_id == user.tenant_id,
            ModelRoute.status == "active",
        )
    )
    if platform_route is None:
        raise NotFoundError("Platform model route does not exist")
    user_route = UserModelRoute(
        tenant_id=user.tenant_id,
        user_id=user.id,
        model_route_id=platform_route.id,
        name=payload.name.strip(),
        level=payload.level,
        priority=payload.priority,
        quota_limit=payload.quota_limit,
        status="active",
    )
    session.add(user_route)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("A user model route with this name already exists") from exc
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="user_model_route.create",
        resource_type="user_model_route",
        resource_id=user_route.id,
        trace_id=trace_id,
        details={"model": platform_route.model, "priority": user_route.priority},
    )
    await session.commit()
    await session.refresh(user_route)
    return ApiResponse(data=_route_read(user_route, platform_route))


@router.patch("/me/model-routes/{user_route_id}", response_model=ApiResponse[UserModelRouteRead])
async def update_my_model_route(
    user_route_id: int,
    payload: UserModelRouteUpdate,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[UserModelRouteRead]:
    user_route, platform_route = await _user_route_or_404(session, user, user_route_id)
    if user_route.version != payload.resource_version:
        raise ConflictError("User model route resource version is stale")
    changes = payload.model_dump(exclude_unset=True, exclude={"resource_version"})
    quota_limit = int(changes.get("quota_limit", user_route.quota_limit))
    if quota_limit < user_route.quota_used + user_route.quota_reserved:
        raise InvalidStateError("Route quota cannot be lower than current usage")
    if "name" in changes:
        changes["name"] = str(changes["name"]).strip()
    for field, value in changes.items():
        setattr(user_route, field, value)
    user_route.version += 1
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("A user model route with this name already exists") from exc
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="user_model_route.update",
        resource_type="user_model_route",
        resource_id=user_route.id,
        trace_id=trace_id,
        details={"changed_fields": sorted(changes)},
    )
    await session.commit()
    await session.refresh(user_route)
    return ApiResponse(data=_route_read(user_route, platform_route))


@router.post(
    "/me/model-routes/{user_route_id}/test",
    response_model=ApiResponse[ModelRouteTestResult],
)
async def test_my_model_route(
    user_route_id: int,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[ModelRouteTestResult]:
    user_route, platform_route = await _user_route_or_404(session, user, user_route_id)
    result = await probe_model_route(platform_route)
    platform_route.health_status = result.health_status
    platform_route.last_checked_at = datetime.now(UTC)
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="user_model_route.test",
        resource_type="user_model_route",
        resource_id=user_route.id,
        trace_id=trace_id,
        details={
            "ok": result.ok,
            "health_status": result.health_status,
            "latency_ms": result.latency_ms,
        },
    )
    await session.commit()
    return ApiResponse(
        data=ModelRouteTestResult(
            ok=result.ok,
            latency_ms=result.latency_ms,
            health_status=result.health_status,
            sample_models=result.sample_models,
            message="Model connection succeeded" if result.ok else "Model connection failed",
        )
    )


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
    _, routes, bindings = await ensure_user_model_profile(
        session,
        tenant_id=user.tenant_id,
        user_id=user.id,
    )
    allowed_route_ids = {route.id for route in routes if route.status == "active"}
    if not set(payload.route_ids).issubset(allowed_route_ids):
        raise InvalidStateError("Agent bindings can only contain active routes owned by the user")
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
    user_route_id: int | None = None,
) -> ApiResponse[Page[UserModelCallLogRead]]:
    filters = [ModelCallLog.tenant_id == user.tenant_id, ModelCallLog.user_id == user.id]
    if user_route_id is not None:
        filters.append(ModelCallLog.user_route_id == user_route_id)
    total = await session.scalar(select(func.count(ModelCallLog.id)).where(*filters)) or 0
    rows = list(
        (
            await session.execute(
                select(ModelCallLog, UserModelRoute, ModelRoute)
                .join(UserModelRoute, UserModelRoute.id == ModelCallLog.user_route_id)
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
                    user_route_id=user_route.id,
                    route_name=user_route.name,
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
                    fallback_from_user_route_id=log.fallback_from_user_route_id,
                    fallback_reason=log.fallback_reason,
                    created_at=log.created_at,
                )
                for log, user_route, platform_route in rows
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
