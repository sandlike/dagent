from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from sqlalchemy import func, or_, select, update

from dagent.api.deps import CurrentUser, SessionDep, TraceId
from dagent.api.errors import ConflictError, NotFoundError
from dagent.api.schemas.common import ApiResponse
from dagent.api.schemas.platform import (
    AgentDefinitionCreate,
    AgentDefinitionRead,
    AgentDefinitionUpdate,
    AgentPublishRequest,
    AgentVersionCreate,
    AgentVersionRead,
)
from dagent.models import AgentDefinition, AgentVersion, User
from dagent.services.audit import add_audit_log

router = APIRouter()
ACTIVE_AGENT_ROLES = ("requirement_clarification", "development_document", "development")


def _is_admin(user: User) -> bool:
    return "admin" in user.roles


async def _definition(
    session: SessionDep,
    user: User,
    agent_id: int,
    *,
    require_manage: bool = False,
) -> AgentDefinition:
    query = select(AgentDefinition).where(
        AgentDefinition.id == agent_id,
        AgentDefinition.tenant_id == user.tenant_id,
        AgentDefinition.role_type.in_(ACTIVE_AGENT_ROLES),
    )
    if require_manage and not _is_admin(user):
        query = query.where(AgentDefinition.owner_user_id == user.id)
    elif not require_manage and not _is_admin(user):
        query = query.where(
            or_(AgentDefinition.owner_user_id.is_(None), AgentDefinition.owner_user_id == user.id)
        )
    item = await session.scalar(query)
    if item is None:
        raise NotFoundError("Agent definition not found")
    return item


async def _read(session: SessionDep, item: AgentDefinition, user: User) -> AgentDefinitionRead:
    versions = list(
        (
            await session.scalars(
                select(AgentVersion).where(AgentVersion.agent_id == item.id).order_by(AgentVersion.version.desc())
            )
        ).all()
    )
    definition = AgentDefinitionRead.model_validate(item)
    return definition.model_copy(
        update={
            "can_manage": _is_admin(user) or item.owner_user_id == user.id,
            "versions": [AgentVersionRead.model_validate(version) for version in versions],
        }
    )


@router.get("/agent-definitions", response_model=ApiResponse[list[AgentDefinitionRead]])
async def list_agent_definitions(user: CurrentUser, session: SessionDep) -> ApiResponse[list[AgentDefinitionRead]]:
    query = select(AgentDefinition).where(
        AgentDefinition.tenant_id == user.tenant_id,
        AgentDefinition.role_type.in_(ACTIVE_AGENT_ROLES),
    )
    if not _is_admin(user):
        query = query.where(
            or_(AgentDefinition.owner_user_id.is_(None), AgentDefinition.owner_user_id == user.id)
        )
    definitions = list(
        (
            await session.scalars(
                query.order_by(AgentDefinition.role_type, AgentDefinition.name)
            )
        ).all()
    )
    return ApiResponse(data=[await _read(session, item, user) for item in definitions])


@router.post(
    "/agent-definitions",
    response_model=ApiResponse[AgentDefinitionRead],
    status_code=201,
)
async def create_agent_definition(
    payload: AgentDefinitionCreate,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[AgentDefinitionRead]:
    has_default = await session.scalar(
        select(AgentDefinition.id).where(
            AgentDefinition.tenant_id == user.tenant_id,
            AgentDefinition.owner_user_id == user.id,
            AgentDefinition.role_type == payload.role_type,
            AgentDefinition.default_flag.is_(True),
            AgentDefinition.status == "active",
        )
    )
    default_flag = payload.default_flag or has_default is None
    if default_flag:
        await session.execute(
            update(AgentDefinition)
            .where(
                AgentDefinition.tenant_id == user.tenant_id,
                AgentDefinition.owner_user_id == user.id,
                AgentDefinition.role_type == payload.role_type,
            )
            .values(default_flag=False)
        )
    item = AgentDefinition(
        tenant_id=user.tenant_id,
        owner_user_id=user.id,
        **payload.model_dump(exclude={"default_flag"}),
        default_flag=default_flag,
    )
    session.add(item)
    await session.flush()
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="agent_definition.create",
        resource_type="agent_definition",
        resource_id=item.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(item)
    return ApiResponse(data=await _read(session, item, user))


@router.get("/agent-definitions/{agent_id}", response_model=ApiResponse[AgentDefinitionRead])
async def agent_definition_detail(
    agent_id: int,
    user: CurrentUser,
    session: SessionDep,
) -> ApiResponse[AgentDefinitionRead]:
    return ApiResponse(data=await _read(session, await _definition(session, user, agent_id), user))


@router.patch(
    "/agent-definitions/{agent_id}",
    response_model=ApiResponse[AgentDefinitionRead],
)
async def update_agent_definition(
    agent_id: int,
    payload: AgentDefinitionUpdate,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[AgentDefinitionRead]:
    item = await _definition(session, user, agent_id, require_manage=True)
    values = payload.model_dump(exclude_unset=True)
    if values.get("default_flag") is False and item.default_flag:
        raise ConflictError("Choose another default Agent before clearing this default")
    if values.get("default_flag"):
        await session.execute(
            update(AgentDefinition)
            .where(
                AgentDefinition.tenant_id == user.tenant_id,
                AgentDefinition.owner_user_id == item.owner_user_id,
                AgentDefinition.role_type == item.role_type,
                AgentDefinition.id != item.id,
            )
            .values(default_flag=False)
        )
    for key, value in values.items():
        setattr(item, key, value)
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="agent_definition.update",
        resource_type="agent_definition",
        resource_id=item.id,
        trace_id=trace_id,
        details={"fields": sorted(values)},
    )
    await session.commit()
    await session.refresh(item)
    return ApiResponse(data=await _read(session, item, user))


@router.post(
    "/agent-definitions/{agent_id}/versions",
    response_model=ApiResponse[AgentVersionRead],
    status_code=201,
)
async def create_agent_version(
    agent_id: int,
    payload: AgentVersionCreate,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[AgentVersionRead]:
    item = await _definition(session, user, agent_id, require_manage=True)
    latest = await session.scalar(select(func.max(AgentVersion.version)).where(AgentVersion.agent_id == item.id)) or 0
    version = AgentVersion(agent_id=item.id, version=latest + 1, status="draft", **payload.model_dump())
    session.add(version)
    await session.flush()
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="agent_version.create",
        resource_type="agent_version",
        resource_id=version.id,
        trace_id=trace_id,
        details={"agent_id": item.id, "version": version.version},
    )
    await session.commit()
    await session.refresh(version)
    return ApiResponse(data=AgentVersionRead.model_validate(version))


@router.post(
    "/agent-definitions/{agent_id}/publish",
    response_model=ApiResponse[AgentDefinitionRead],
)
async def publish_agent_version(
    agent_id: int,
    payload: AgentPublishRequest,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[AgentDefinitionRead]:
    item = await _definition(session, user, agent_id, require_manage=True)
    version = await session.scalar(
        select(AgentVersion).where(AgentVersion.id == payload.version_id, AgentVersion.agent_id == item.id)
    )
    if version is None:
        raise NotFoundError("Agent version not found")
    if item.status == "disabled":
        raise ConflictError("A disabled Agent definition cannot publish versions")
    await session.execute(
        update(AgentVersion)
        .where(AgentVersion.agent_id == item.id, AgentVersion.status == "published")
        .values(status="superseded")
    )
    version.status = "published"
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="agent_version.publish",
        resource_type="agent_version",
        resource_id=version.id,
        trace_id=trace_id,
        details={"agent_id": item.id, "version": version.version},
    )
    await session.commit()
    return ApiResponse(data=await _read(session, item, user))


@router.post(
    "/agent-definitions/{agent_id}/disable",
    response_model=ApiResponse[AgentDefinitionRead],
)
async def disable_agent_definition(
    agent_id: int,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[AgentDefinitionRead]:
    item = await _definition(session, user, agent_id, require_manage=True)
    if item.default_flag:
        replacement = await session.scalar(
            select(AgentDefinition)
            .where(
                AgentDefinition.tenant_id == user.tenant_id,
                AgentDefinition.owner_user_id == item.owner_user_id,
                AgentDefinition.role_type == item.role_type,
                AgentDefinition.status == "active",
                AgentDefinition.id != item.id,
            )
            .order_by(AgentDefinition.id)
            .limit(1)
        )
        if replacement is None and item.owner_user_id is None:
            raise ConflictError("The only default Agent for a role cannot be disabled")
        if replacement is not None:
            replacement.default_flag = True
    item.status = "disabled"
    item.default_flag = False
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="agent_definition.disable",
        resource_type="agent_definition",
        resource_id=item.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(item)
    return ApiResponse(data=await _read(session, item, user))


@router.get("/skills", response_model=ApiResponse[list[dict[str, str]]])
async def list_skills(user: CurrentUser, session: SessionDep) -> ApiResponse[list[dict[str, str]]]:
    query = (
        select(AgentVersion)
        .join(AgentDefinition)
        .where(
            AgentDefinition.tenant_id == user.tenant_id,
            AgentDefinition.role_type.in_(ACTIVE_AGENT_ROLES),
            AgentVersion.status == "published",
        )
    )
    if not _is_admin(user):
        query = query.where(
            or_(AgentDefinition.owner_user_id.is_(None), AgentDefinition.owner_user_id == user.id)
        )
    versions = list(
        (
            await session.scalars(
                query
            )
        ).all()
    )
    names = sorted({name for version in versions for name in version.skill_policy})
    return ApiResponse(data=[{"name": name, "status": "allowed"} for name in names])


@router.get("/mcp-servers", response_model=ApiResponse[list[dict[str, Any]]])
async def list_mcp_servers(_: CurrentUser) -> ApiResponse[list[dict[str, Any]]]:
    return ApiResponse(
        data=[
            {
                "name": "serena",
                "status": {
                    "enabled": True,
                    "access": "semantic_read_only",
                    "source": "requirement-runtime-bundle-v2",
                },
            }
        ]
    )
