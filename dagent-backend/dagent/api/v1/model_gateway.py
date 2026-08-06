from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError

from dagent.api.deps import CurrentUser, SessionDep, TraceId, require_roles, verify_agent_callback_token
from dagent.api.errors import ConflictError, InvalidStateError, NotFoundError
from dagent.api.schemas.common import ApiResponse, Page
from dagent.api.schemas.model_gateway import (
    ModelCallLogRead,
    ModelFallbackRequest,
    ModelReservationRead,
    ModelReservationRequest,
    ModelRouteCreate,
    ModelRouteRead,
    ModelRouteTestResult,
    ModelRouteUpdate,
    ModelSettlementRequest,
    ModelUsageItem,
    ProjectModelRouteRead,
    ProjectModelRouteUpdate,
)
from dagent.models import (
    AgentTask,
    ModelCallLog,
    ModelQuotaLedger,
    ModelRoute,
    ProjectModelRoute,
    Requirement,
    User,
)
from dagent.services.audit import add_audit_log
from dagent.services.credentials import encrypt_model_token
from dagent.services.domain import get_project
from dagent.services.model_gateway import (
    fallback_model_route,
    probe_model_route,
    reserve_model_route,
    settle_model_route,
)

router = APIRouter()
admin_user = Depends(require_roles("admin"))
agent_callback = Depends(verify_agent_callback_token)


async def _route_or_404(session: SessionDep, tenant_id: int, route_id: int) -> ModelRoute:
    route = await session.scalar(
        select(ModelRoute).where(ModelRoute.id == route_id, ModelRoute.tenant_id == tenant_id)
    )
    if route is None:
        raise NotFoundError("Model route does not exist")
    return route


@router.get("/model-routes", response_model=ApiResponse[Page[ModelRouteRead]])
async def list_model_routes(
    session: SessionDep,
    user: User = admin_user,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    provider: str | None = None,
) -> ApiResponse[Page[ModelRouteRead]]:
    filters = [ModelRoute.tenant_id == user.tenant_id]
    if status:
        filters.append(ModelRoute.status == status)
    if provider:
        filters.append(ModelRoute.provider == provider)
    total = await session.scalar(select(func.count(ModelRoute.id)).where(*filters)) or 0
    routes = list(
        (
            await session.scalars(
                select(ModelRoute)
                .where(*filters)
                .order_by(ModelRoute.priority, ModelRoute.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return ApiResponse(
        data=Page(
            items=[ModelRouteRead.model_validate(route) for route in routes],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post("/model-routes", response_model=ApiResponse[ModelRouteRead], status_code=201)
async def create_model_route(
    payload: ModelRouteCreate,
    session: SessionDep,
    trace_id: TraceId,
    user: User = admin_user,
) -> ApiResponse[ModelRouteRead]:
    values = payload.model_dump(exclude={"api_token"})
    values["base_url"] = str(payload.base_url).rstrip("/")
    if payload.api_token is not None:
        values["credential_ciphertext"] = encrypt_model_token(payload.api_token.get_secret_value())
        values["credential_ref"] = None
    route = ModelRoute(tenant_id=user.tenant_id, **values)
    session.add(route)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("A model route with this name already exists") from exc
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="model_route.create",
        resource_type="model_route",
        resource_id=route.id,
        trace_id=trace_id,
        details={"name": route.name, "provider": route.provider, "model": route.model},
    )
    await session.commit()
    await session.refresh(route)
    return ApiResponse(data=ModelRouteRead.model_validate(route))


@router.get("/model-routes/{route_id}", response_model=ApiResponse[ModelRouteRead])
async def model_route_detail(
    route_id: int, session: SessionDep, user: User = admin_user
) -> ApiResponse[ModelRouteRead]:
    route = await _route_or_404(session, user.tenant_id, route_id)
    return ApiResponse(data=ModelRouteRead.model_validate(route))


@router.patch("/model-routes/{route_id}", response_model=ApiResponse[ModelRouteRead])
async def update_model_route(
    route_id: int,
    payload: ModelRouteUpdate,
    session: SessionDep,
    trace_id: TraceId,
    user: User = admin_user,
) -> ApiResponse[ModelRouteRead]:
    route = await _route_or_404(session, user.tenant_id, route_id)
    if route.version != payload.resource_version:
        raise ConflictError("Model route resource version is stale")
    changes = payload.model_dump(exclude_unset=True, exclude={"resource_version", "api_token"})
    if "base_url" in changes:
        changes["base_url"] = str(changes["base_url"]).rstrip("/")
    if "api_token" in payload.model_fields_set:
        changes["credential_ciphertext"] = (
            encrypt_model_token(payload.api_token.get_secret_value()) if payload.api_token is not None else None
        )
        changes["credential_ref"] = None
    elif "credential_ref" in changes:
        changes["credential_ciphertext"] = None
    quota_limit = int(changes.get("quota_limit", route.quota_limit))
    if quota_limit < route.quota_used + route.quota_reserved:
        raise InvalidStateError("Quota limit cannot be lower than used and reserved tokens")
    connectivity_fields = {
        "provider",
        "model",
        "base_url",
        "api_protocol",
        "credential_ref",
        "credential_ciphertext",
    }
    for field, value in changes.items():
        setattr(route, field, value)
    if connectivity_fields.intersection(changes):
        route.health_status = "unknown"
        route.detected_api_protocol = None
        route.status = "disabled"
    route.version += 1
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="model_route.update",
        resource_type="model_route",
        resource_id=route.id,
        trace_id=trace_id,
        details={"fields": sorted(changes)},
    )
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("A model route with this name already exists") from exc
    await session.refresh(route)
    return ApiResponse(data=ModelRouteRead.model_validate(route))


@router.post("/model-routes/{route_id}/test", response_model=ApiResponse[ModelRouteTestResult])
async def test_model_route(
    route_id: int,
    session: SessionDep,
    trace_id: TraceId,
    user: User = admin_user,
) -> ApiResponse[ModelRouteTestResult]:
    route = await _route_or_404(session, user.tenant_id, route_id)
    result = await probe_model_route(route)
    route.health_status = result.health_status
    if result.detected_api_protocol is not None:
        route.detected_api_protocol = result.detected_api_protocol
    route.last_checked_at = datetime.now().astimezone()
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="model_route.test",
        resource_type="model_route",
        resource_id=route.id,
        trace_id=trace_id,
        details={"ok": result.ok, "latency_ms": result.latency_ms},
    )
    await session.commit()
    return ApiResponse(data=result)


async def _set_route_status(
    route_id: int,
    target_status: str,
    session: SessionDep,
    trace_id: str,
    user: User,
) -> ApiResponse[ModelRouteRead]:
    route = await _route_or_404(session, user.tenant_id, route_id)
    if target_status == "active" and route.health_status != "healthy":
        raise InvalidStateError("Test the model route successfully before enabling it")
    route.status = target_status
    route.version += 1
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action=f"model_route.{target_status}",
        resource_type="model_route",
        resource_id=route.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(route)
    return ApiResponse(data=ModelRouteRead.model_validate(route))


@router.post("/model-routes/{route_id}/enable", response_model=ApiResponse[ModelRouteRead])
async def enable_model_route(
    route_id: int,
    session: SessionDep,
    trace_id: TraceId,
    user: User = admin_user,
) -> ApiResponse[ModelRouteRead]:
    return await _set_route_status(route_id, "active", session, trace_id, user)


@router.post("/model-routes/{route_id}/disable", response_model=ApiResponse[ModelRouteRead])
async def disable_model_route(
    route_id: int,
    session: SessionDep,
    trace_id: TraceId,
    user: User = admin_user,
) -> ApiResponse[ModelRouteRead]:
    return await _set_route_status(route_id, "disabled", session, trace_id, user)


@router.post("/model-routes/{route_id}/quota/reset", response_model=ApiResponse[ModelRouteRead])
async def reset_model_route_quota(
    route_id: int,
    session: SessionDep,
    trace_id: TraceId,
    user: User = admin_user,
) -> ApiResponse[ModelRouteRead]:
    route = await _route_or_404(session, user.tenant_id, route_id)
    if route.quota_reserved:
        raise InvalidStateError("Cannot reset quota while model calls have reserved tokens")
    route.quota_used = 0
    route.version += 1
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="model_route.quota_reset",
        resource_type="model_route",
        resource_id=route.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(route)
    return ApiResponse(data=ModelRouteRead.model_validate(route))


@router.get("/model-usage", response_model=ApiResponse[list[ModelUsageItem]])
async def model_usage(
    session: SessionDep,
    user: User = admin_user,
    route_id: int | None = None,
    project_id: int | None = None,
    requirement_id: int | None = None,
    task_id: int | None = None,
) -> ApiResponse[list[ModelUsageItem]]:
    filters = [ModelQuotaLedger.tenant_id == user.tenant_id]
    if route_id is not None:
        filters.append(ModelQuotaLedger.route_id == route_id)
    if task_id is not None:
        filters.append(ModelQuotaLedger.task_id == task_id)
    if project_id is not None:
        filters.append(Requirement.project_id == project_id)
    if requirement_id is not None:
        filters.append(Requirement.id == requirement_id)
    aggregates = (
        await session.execute(
            select(
                ModelQuotaLedger.route_id,
                func.coalesce(
                    func.sum(
                        case(
                            (ModelQuotaLedger.status == "reserved", ModelQuotaLedger.reserved_tokens),
                            else_=0,
                        )
                    ),
                    0,
                ),
                func.coalesce(func.sum(ModelQuotaLedger.input_tokens), 0),
                func.coalesce(func.sum(ModelQuotaLedger.output_tokens), 0),
                func.coalesce(func.sum(ModelQuotaLedger.released_tokens), 0),
                func.count(ModelQuotaLedger.id),
            )
            .join(AgentTask, AgentTask.id == ModelQuotaLedger.task_id)
            .join(Requirement, Requirement.id == AgentTask.requirement_id)
            .where(*filters)
            .group_by(ModelQuotaLedger.route_id)
        )
    ).all()
    aggregate_by_route = {int(row[0]): row for row in aggregates}
    route_filters = [ModelRoute.tenant_id == user.tenant_id]
    if route_id is not None:
        route_filters.append(ModelRoute.id == route_id)
    routes = list((await session.scalars(select(ModelRoute).where(*route_filters))).all())
    items: list[ModelUsageItem] = []
    for route in routes:
        row = aggregate_by_route.get(route.id)
        reserved, input_tokens, output_tokens, released, calls = (row[1:] if row else (0, 0, 0, 0, 0))
        items.append(
            ModelUsageItem(
                route_id=route.id,
                route_name=route.name,
                provider=route.provider,
                model=route.model,
                quota_limit=route.quota_limit,
                reserved_tokens=int(reserved),
                input_tokens=int(input_tokens),
                output_tokens=int(output_tokens),
                released_tokens=int(released),
                used_tokens=int(input_tokens) + int(output_tokens),
                remaining_tokens=max(0, route.quota_limit - route.quota_reserved - route.quota_used),
                call_count=int(calls),
            )
        )
    return ApiResponse(data=sorted(items, key=lambda item: item.route_id))


@router.get("/model-call-logs", response_model=ApiResponse[Page[ModelCallLogRead]])
async def model_call_logs(
    session: SessionDep,
    user: User = admin_user,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    route_id: int | None = None,
    project_id: int | None = None,
    requirement_id: int | None = None,
    task_id: int | None = None,
    trace_id: str | None = None,
) -> ApiResponse[Page[ModelCallLogRead]]:
    filters = [ModelCallLog.tenant_id == user.tenant_id]
    for column, value in (
        (ModelCallLog.route_id, route_id),
        (ModelCallLog.project_id, project_id),
        (ModelCallLog.requirement_id, requirement_id),
        (ModelCallLog.task_id, task_id),
        (ModelCallLog.trace_id, trace_id),
    ):
        if value is not None:
            filters.append(column == value)
    total = await session.scalar(select(func.count(ModelCallLog.id)).where(*filters)) or 0
    logs = list(
        (
            await session.scalars(
                select(ModelCallLog)
                .where(*filters)
                .order_by(ModelCallLog.created_at.desc(), ModelCallLog.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return ApiResponse(
        data=Page(
            items=[ModelCallLogRead.model_validate(log) for log in logs],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.get("/projects/{project_id}/model-route", response_model=ApiResponse[ProjectModelRouteRead])
async def project_model_route(
    project_id: int, user: CurrentUser, session: SessionDep
) -> ApiResponse[ProjectModelRouteRead]:
    project = await get_project(session, user, project_id)
    binding = await session.scalar(
        select(ProjectModelRoute).where(
            ProjectModelRoute.tenant_id == user.tenant_id,
            ProjectModelRoute.project_id == project.id,
        )
    )
    route = await session.get(ModelRoute, binding.route_id) if binding and binding.route_id else None
    return ApiResponse(
        data=ProjectModelRouteRead(
            project_id=project.id,
            route_id=route.id if route else None,
            route_name=route.name if route else None,
            resource_version=binding.version if binding else 1,
        )
    )


@router.put("/projects/{project_id}/model-route", response_model=ApiResponse[ProjectModelRouteRead])
async def update_project_model_route(
    project_id: int,
    payload: ProjectModelRouteUpdate,
    session: SessionDep,
    trace_id: TraceId,
    user: User = admin_user,
) -> ApiResponse[ProjectModelRouteRead]:
    project = await get_project(session, user, project_id)
    binding = await session.scalar(
        select(ProjectModelRoute).where(
            ProjectModelRoute.tenant_id == user.tenant_id,
            ProjectModelRoute.project_id == project.id,
        )
    )
    current_version = binding.version if binding else 1
    if current_version != payload.resource_version:
        raise ConflictError("Project model route resource version is stale")
    route = None
    if payload.route_id is not None:
        route = await _route_or_404(session, user.tenant_id, payload.route_id)
        if route.status != "active":
            raise InvalidStateError("Only an active model route can be assigned to a project")
    if binding is None:
        binding = ProjectModelRoute(
            tenant_id=user.tenant_id,
            project_id=project.id,
            route_id=payload.route_id,
            updated_by=user.id,
            version=1,
        )
        session.add(binding)
    else:
        binding.route_id = payload.route_id
        binding.updated_by = user.id
        binding.version += 1
    await session.flush()
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="project.model_route_update",
        resource_type="project",
        resource_id=project.id,
        trace_id=trace_id,
        details={"route_id": payload.route_id},
    )
    await session.commit()
    await session.refresh(binding)
    return ApiResponse(
        data=ProjectModelRouteRead(
            project_id=project.id,
            route_id=route.id if route else None,
            route_name=route.name if route else None,
            resource_version=binding.version,
        )
    )


@router.post(
    "/internal/model-reservations",
    response_model=ApiResponse[ModelReservationRead],
    dependencies=[agent_callback],
)
async def reserve_model(payload: ModelReservationRequest, session: SessionDep) -> ApiResponse[ModelReservationRead]:
    return ApiResponse(data=await reserve_model_route(session, payload))


@router.post(
    "/internal/model-reservations/{request_id}/fallback",
    response_model=ApiResponse[ModelReservationRead],
    dependencies=[agent_callback],
)
async def fallback_model(
    request_id: str, payload: ModelFallbackRequest, session: SessionDep
) -> ApiResponse[ModelReservationRead]:
    return ApiResponse(data=await fallback_model_route(session, request_id, payload))


@router.post(
    "/internal/model-reservations/{request_id}/settle",
    response_model=ApiResponse[dict[str, bool]],
    dependencies=[agent_callback],
)
async def settle_model(
    request_id: str, payload: ModelSettlementRequest, session: SessionDep
) -> ApiResponse[dict[str, bool]]:
    await settle_model_route(session, request_id, payload)
    return ApiResponse(data={"settled": True})
