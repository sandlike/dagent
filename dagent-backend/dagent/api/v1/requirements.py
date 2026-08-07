import asyncio
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy import delete, func, or_, select, update
from sse_starlette.sse import EventSourceResponse

from dagent.api.deps import CurrentUser, SessionDep, TraceId, require_roles
from dagent.api.errors import (
    ConflictError,
    ExternalDependencyError,
    InvalidStateError,
    NotFoundError,
    PermissionDeniedError,
)
from dagent.api.schemas.common import ApiResponse, Page
from dagent.api.schemas.domain import (
    AgentSessionRead,
    AgentTaskRead,
    ArtifactReviseRequest,
    CancelRequest,
    ClarificationAnswersRequest,
    ClarificationConfirmRequest,
    PipelineRead,
    RequirementCreate,
    RequirementRead,
    RequirementUpdate,
    ResourceVersionRequest,
    ReviewGate,
    ReviewRequest,
    TaskCreateRequest,
)
from dagent.models import (
    AgentDefinition,
    AgentSession,
    AgentTask,
    AgentVersion,
    Artifact,
    ArtifactVersion,
    ClarificationAnswer,
    ClarificationQuestion,
    ClarificationRound,
    Pipeline,
    ProjectMember,
    ProjectRepository,
    Requirement,
    RequirementRepository,
    ReviewRecord,
    StageHistory,
    User,
)
from dagent.pipeline.state_machine import AUTOMATED_STATES, PipelineState, RunStatus
from dagent.services.audit import add_audit_log
from dagent.services.domain import (
    add_artifact_version,
    create_agent_task,
    get_artifact,
    get_project,
    get_requirement,
    transition_requirement,
)
from dagent.services.workspaces import push_requirement_workspaces

router = APIRouter()


async def _ensure_requirement_runtime(request: Request, requirement: Requirement) -> None:
    orchestrator = getattr(request.app.state, "requirement_runtime", None)
    if orchestrator is None:
        return
    try:
        await orchestrator.ensure_requirement(requirement.id, requirement.tenant_id)
    except Exception as exc:  # noqa: BLE001
        raise ExternalDependencyError(
            f"Requirement was saved but its Agent Pod could not be created: {exc}"
        ) from exc


async def _remove_requirement_runtime(request: Request, requirement: Requirement) -> None:
    orchestrator = getattr(request.app.state, "requirement_runtime", None)
    if orchestrator is None:
        return
    try:
        await orchestrator.remove_requirement(
            requirement.id,
            delete_workspace=(requirement.workspace_retention_policy == "delete"),
        )
    except Exception as exc:  # noqa: BLE001
        raise ExternalDependencyError(
            f"Requirement state was saved but its Agent Pod could not be removed: {exc}"
        ) from exc

GATE_CONFIG: dict[str, dict[str, Any]] = {
    "development_document": {
        "stage": PipelineState.DEVELOPMENT_DOCUMENT_REVIEW,
        "artifact": "development_document",
        "roles": {"pm"},
    },
    "development_report": {
        "stage": PipelineState.DEVELOPMENT_REPORT_REVIEW,
        "artifact": "development_report",
        "roles": {"developer"},
    },
    "test_plan": {
        "stage": PipelineState.TEST_PLAN_REVIEW,
        "artifact": "test_plan",
        "roles": {"pm", "qa"},
    },
    "final_acceptance": {
        "stage": PipelineState.FINAL_ACCEPTANCE,
        "artifact": "test_plan",
        "roles": {"pm"},
    },
}


def _resolved_answer(question: ClarificationQuestion, raw_answer: Any) -> tuple[Any, list[str]]:
    option_labels = {
        str(option.get("id")): str(option.get("label") or option.get("value") or option.get("id"))
        for option in question.options
        if isinstance(option, dict) and option.get("id") is not None
    }
    values = raw_answer if isinstance(raw_answer, list) else [raw_answer]
    labels = [option_labels[str(value)] for value in values if str(value) in option_labels]
    if not labels:
        return raw_answer, []
    return (labels if isinstance(raw_answer, list) else labels[0]), labels

TASK_TYPE_BY_STAGE = {
    PipelineState.DEVELOPMENT_DOCUMENT_GENERATION: "development_document_generation",
    PipelineState.DEVELOPMENT: "development",
    PipelineState.TEST_PLAN_GENERATION: "test_plan_generation",
}


async def _task_type_for_stage(session: SessionDep, requirement: Requirement) -> str | None:
    stage = PipelineState(requirement.stage)
    if stage != PipelineState.DEVELOPMENT:
        return TASK_TYPE_BY_STAGE.get(stage)
    pipeline_id = await session.scalar(select(Pipeline.id).where(Pipeline.requirement_id == requirement.id))
    latest = await session.scalar(
        select(StageHistory)
        .where(
            StageHistory.pipeline_id == pipeline_id,
            StageHistory.to_stage == PipelineState.DEVELOPMENT.value,
        )
        .order_by(StageHistory.id.desc())
        .limit(1)
    )
    if latest and latest.from_stage != PipelineState.DEVELOPMENT_DOCUMENT_REVIEW.value:
        return "failure_fix"
    return "development"


def _require_version(requirement: Requirement, resource_version: int) -> None:
    if requirement.version != resource_version:
        raise ConflictError(f"Requirement resource version is stale; current version is {requirement.version}")


async def _repository_ids(session: SessionDep, requirement_id: int) -> list[int]:
    return list(
        (
            await session.scalars(
                select(RequirementRepository.repository_id).where(
                    RequirementRepository.requirement_id == requirement_id
                )
            )
        ).all()
    )


async def _requirement_read(session: SessionDep, requirement: Requirement) -> RequirementRead:
    return RequirementRead.model_validate(requirement).model_copy(
        update={"repository_ids": await _repository_ids(session, requirement.id)}
    )


async def _validate_repository_scope(session: SessionDep, project_id: int, repository_ids: set[int]) -> None:
    if not repository_ids:
        return
    bound = set(
        (
            await session.scalars(
                select(ProjectRepository.repository_id).where(
                    ProjectRepository.project_id == project_id,
                    ProjectRepository.repository_id.in_(repository_ids),
                )
            )
        ).all()
    )
    if bound != repository_ids:
        raise ConflictError("Every requirement repository must already be bound to the project")


async def _validate_agent_version(
    session: SessionDep,
    user: User,
    agent_version_id: int | None,
    expected_role: str,
) -> None:
    if agent_version_id is None:
        return
    query = (
        select(AgentVersion)
        .join(AgentDefinition)
        .where(
            AgentVersion.id == agent_version_id,
            AgentVersion.status == "published",
            AgentDefinition.tenant_id == user.tenant_id,
            AgentDefinition.role_type == expected_role,
            AgentDefinition.status == "active",
        )
    )
    if "admin" not in user.roles:
        query = query.where(
            or_(AgentDefinition.owner_user_id.is_(None), AgentDefinition.owner_user_id == user.id)
        )
    version = await session.scalar(query)
    if version is None:
        raise ConflictError(f"Agent version {agent_version_id} is not a published {expected_role} agent")


@router.get("", response_model=ApiResponse[Page[RequirementRead]])
async def list_requirements(
    user: CurrentUser,
    session: SessionDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    project_id: int | None = None,
    stage: str | None = None,
    priority: str | None = Query(default=None, pattern="^P[0-3]$"),
) -> ApiResponse[Page[RequirementRead]]:
    query = select(Requirement).where(
        Requirement.tenant_id == user.tenant_id,
        Requirement.deleted_at.is_(None),
    )
    count_query = select(func.count(Requirement.id)).where(
        Requirement.tenant_id == user.tenant_id,
        Requirement.deleted_at.is_(None),
    )
    if "admin" not in user.roles:
        query = query.join(ProjectMember, ProjectMember.project_id == Requirement.project_id).where(
            ProjectMember.user_id == user.id
        )
        count_query = count_query.join(ProjectMember, ProjectMember.project_id == Requirement.project_id).where(
            ProjectMember.user_id == user.id
        )
    if project_id is not None:
        query = query.where(Requirement.project_id == project_id)
        count_query = count_query.where(Requirement.project_id == project_id)
    if stage is not None:
        query = query.where(Requirement.stage == stage)
        count_query = count_query.where(Requirement.stage == stage)
    if priority is not None:
        query = query.where(Requirement.priority == priority)
        count_query = count_query.where(Requirement.priority == priority)
    total = await session.scalar(count_query) or 0
    requirements = list(
        (
            await session.scalars(
                query.order_by(Requirement.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
            )
        ).all()
    )
    return ApiResponse(
        data=Page(
            items=[await _requirement_read(session, item) for item in requirements],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post("", response_model=ApiResponse[RequirementRead], status_code=201)
async def create_requirement(
    payload: RequirementCreate,
    request: Request,
    session: SessionDep,
    trace_id: TraceId,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[RequirementRead]:
    scoped_key = f"{user.tenant_id}:{idempotency_key}" if idempotency_key else None
    if scoped_key:
        existing = await session.scalar(select(Requirement).where(Requirement.create_idempotency_key == scoped_key))
        if existing is not None:
            if existing.deleted_at is None:
                await _ensure_requirement_runtime(request, existing)
            return ApiResponse(data=await _requirement_read(session, existing))
    project = await get_project(session, user, payload.project_id)
    if project.status != "active":
        raise ConflictError("Cannot create a requirement in an archived project")
    repository_ids = set(payload.repository_ids)
    await _validate_repository_scope(session, project.id, repository_ids)
    await _validate_agent_version(
        session,
        user,
        payload.requirement_agent_version_id,
        "requirement_clarification",
    )
    await _validate_agent_version(
        session,
        user,
        payload.development_document_agent_version_id,
        "development_document",
    )
    await _validate_agent_version(session, user, payload.development_agent_version_id, "development")
    requirement = Requirement(
        tenant_id=user.tenant_id,
        project_id=project.id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        created_by=user.id,
        requirement_agent_version_id=payload.requirement_agent_version_id,
        development_document_agent_version_id=payload.development_document_agent_version_id,
        development_agent_version_id=payload.development_agent_version_id,
        workspace_retention_policy=payload.workspace_retention_policy,
        create_idempotency_key=scoped_key,
    )
    session.add(requirement)
    await session.flush()
    session.add(
        Pipeline(
            tenant_id=user.tenant_id,
            requirement_id=requirement.id,
            current_stage=requirement.stage,
            run_status=requirement.run_status,
        )
    )
    session.add_all(
        [
            RequirementRepository(requirement_id=requirement.id, repository_id=repository_id)
            for repository_id in repository_ids
        ]
    )
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="requirement.create",
        resource_type="requirement",
        resource_id=requirement.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(requirement)
    await _ensure_requirement_runtime(request, requirement)
    return ApiResponse(data=await _requirement_read(session, requirement))


@router.get("/{requirement_id}", response_model=ApiResponse[RequirementRead])
async def requirement_detail(
    requirement_id: int, user: CurrentUser, session: SessionDep
) -> ApiResponse[RequirementRead]:
    return ApiResponse(data=await _requirement_read(session, await get_requirement(session, user, requirement_id)))


@router.patch("/{requirement_id}", response_model=ApiResponse[RequirementRead])
async def update_requirement(
    requirement_id: int,
    payload: RequirementUpdate,
    session: SessionDep,
    trace_id: TraceId,
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[RequirementRead]:
    requirement = await get_requirement(session, user, requirement_id)
    if requirement.stage == PipelineState.REQUIREMENT_CLARIFICATION.value:
        latest_round = await session.scalar(
            select(ClarificationRound)
            .where(ClarificationRound.requirement_id == requirement.id)
            .order_by(ClarificationRound.round_no.desc())
            .limit(1)
        )
        if latest_round is None or latest_round.status != "confirmed":
            raise InvalidStateError("Requirement details can only be edited after a confirmed clarification round")
    elif requirement.stage != PipelineState.REQUIREMENT_DRAFT.value:
        raise InvalidStateError("Only draft requirements or rejected clarifications can be edited")
    _require_version(requirement, payload.resource_version)
    if payload.repository_ids is not None:
        repository_ids = set(payload.repository_ids)
        await _validate_repository_scope(session, requirement.project_id, repository_ids)
        await session.execute(
            delete(RequirementRepository).where(RequirementRepository.requirement_id == requirement.id)
        )
        session.add_all(
            [RequirementRepository(requirement_id=requirement.id, repository_id=item) for item in repository_ids]
        )
    if payload.requirement_agent_version_id is not None:
        await _validate_agent_version(
            session,
            user,
            payload.requirement_agent_version_id,
            "requirement_clarification",
        )
    if payload.development_document_agent_version_id is not None:
        await _validate_agent_version(
            session,
            user,
            payload.development_document_agent_version_id,
            "development_document",
        )
    if payload.development_agent_version_id is not None:
        await _validate_agent_version(session, user, payload.development_agent_version_id, "development")
    changes = payload.model_dump(
        exclude_unset=True,
        exclude={"repository_ids", "resource_version"},
    )
    for field, value in changes.items():
        setattr(requirement, field, value)
    requirement.version += 1
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="requirement.update",
        resource_type="requirement",
        resource_id=requirement.id,
        trace_id=trace_id,
        details={"fields": sorted(changes)},
    )
    await session.commit()
    await session.refresh(requirement)
    return ApiResponse(data=await _requirement_read(session, requirement))


@router.post("/{requirement_id}/submit", response_model=ApiResponse[RequirementRead])
async def submit_requirement(
    requirement_id: int,
    payload: ResourceVersionRequest,
    session: SessionDep,
    trace_id: TraceId,
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[RequirementRead]:
    requirement = await get_requirement(session, user, requirement_id)
    _require_version(requirement, payload.resource_version)
    if not requirement.description.strip():
        raise ConflictError("Requirement description is required before submission")
    repository_ids = await _repository_ids(session, requirement.id)
    if not repository_ids:
        raise ConflictError("At least one repository is required before submission")
    artifact_version = await add_artifact_version(
        session,
        requirement,
        artifact_type="requirement_document",
        content={
            "title": requirement.title,
            "description": requirement.description,
            "priority": requirement.priority,
            "repository_ids": repository_ids,
        },
        source="user",
        created_by=user.id,
    )
    await transition_requirement(
        session,
        requirement,
        action="submit",
        operator_type="user",
        operator_id=user.id,
        artifact_versions={"requirement_document": artifact_version.version},
    )
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="requirement.submit",
        resource_type="requirement",
        resource_id=requirement.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(requirement)
    return ApiResponse(data=await _requirement_read(session, requirement))


@router.post("/{requirement_id}/pause", response_model=ApiResponse[RequirementRead])
async def pause_requirement(
    requirement_id: int,
    payload: ResourceVersionRequest,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[RequirementRead]:
    requirement = await get_requirement(session, user, requirement_id)
    _require_version(requirement, payload.resource_version)
    if requirement.run_status not in {RunStatus.RUNNING.value, RunStatus.IDLE.value}:
        raise InvalidStateError(f"Cannot pause a requirement in {requirement.run_status} status")
    requirement.run_status = RunStatus.PAUSED.value
    requirement.version += 1
    pipeline = await session.scalar(select(Pipeline).where(Pipeline.requirement_id == requirement.id))
    if pipeline:
        pipeline.run_status = RunStatus.PAUSED.value
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="requirement.pause",
        resource_type="requirement",
        resource_id=requirement.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(requirement)
    return ApiResponse(data=await _requirement_read(session, requirement))


@router.post("/{requirement_id}/resume", response_model=ApiResponse[RequirementRead])
async def resume_requirement(
    requirement_id: int,
    payload: ResourceVersionRequest,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[RequirementRead]:
    requirement = await get_requirement(session, user, requirement_id)
    _require_version(requirement, payload.resource_version)
    if requirement.run_status != RunStatus.PAUSED.value:
        raise InvalidStateError("Only paused requirements can be resumed")
    requirement.run_status = RunStatus.IDLE.value
    requirement.version += 1
    pipeline = await session.scalar(select(Pipeline).where(Pipeline.requirement_id == requirement.id))
    if pipeline:
        pipeline.run_status = RunStatus.IDLE.value
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="requirement.resume",
        resource_type="requirement",
        resource_id=requirement.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(requirement)
    return ApiResponse(data=await _requirement_read(session, requirement))


@router.post("/{requirement_id}/cancel", response_model=ApiResponse[RequirementRead])
async def cancel_requirement(
    requirement_id: int,
    payload: CancelRequest,
    request: Request,
    session: SessionDep,
    trace_id: TraceId,
    user: User = Depends(require_roles("pm", "developer")),
) -> ApiResponse[RequirementRead]:
    requirement = await get_requirement(session, user, requirement_id)
    _require_version(requirement, payload.resource_version)
    if not payload.confirmed:
        raise ConflictError("Cancellation requires explicit confirmation")
    if requirement.stage == PipelineState.COMPLETED.value:
        raise InvalidStateError("Completed requirements cannot be cancelled")
    requirement.run_status = RunStatus.CANCELLED.value
    requirement.cancelled_at = datetime.now(UTC)
    requirement.version += 1
    pipeline = await session.scalar(select(Pipeline).where(Pipeline.requirement_id == requirement.id))
    if pipeline:
        pipeline.run_status = RunStatus.CANCELLED.value
    now = datetime.now(UTC)
    await session.execute(
        update(AgentTask)
        .where(
            AgentTask.requirement_id == requirement.id,
            AgentTask.status.in_(("queued", "running")),
        )
        .values(
            status="cancelled",
            completed_at=now,
            error_message="Requirement cancelled by user",
        )
    )
    await session.execute(
        update(AgentSession)
        .where(
            AgentSession.requirement_id == requirement.id,
            AgentSession.status == "active",
        )
        .values(status="requirement_cancelled")
    )
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="requirement.cancel",
        resource_type="requirement",
        resource_id=requirement.id,
        trace_id=trace_id,
        details={"reason": payload.reason},
    )
    await session.commit()
    await session.refresh(requirement)
    await _remove_requirement_runtime(request, requirement)
    return ApiResponse(data=await _requirement_read(session, requirement))


@router.delete("/{requirement_id}", response_model=ApiResponse[dict[str, Any]])
async def delete_requirement(
    requirement_id: int,
    request: Request,
    session: SessionDep,
    trace_id: TraceId,
    resource_version: int = Query(ge=1),
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[dict[str, Any]]:
    requirement = await get_requirement(session, user, requirement_id)
    _require_version(requirement, resource_version)
    now = datetime.now(UTC)
    requirement.deleted_at = now
    requirement.cancelled_at = requirement.cancelled_at or now
    requirement.run_status = RunStatus.CANCELLED.value
    requirement.version += 1
    pipeline = await session.scalar(select(Pipeline).where(Pipeline.requirement_id == requirement.id))
    if pipeline is not None:
        pipeline.run_status = RunStatus.CANCELLED.value
    await session.execute(
        update(AgentTask)
        .where(
            AgentTask.requirement_id == requirement.id,
            AgentTask.status.in_(("queued", "running")),
        )
        .values(
            status="cancelled",
            completed_at=now,
            error_message="Requirement deleted by user",
        )
    )
    await session.execute(
        update(AgentSession)
        .where(
            AgentSession.requirement_id == requirement.id,
            AgentSession.status == "active",
        )
        .values(status="requirement_deleted")
    )
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="requirement.delete",
        resource_type="requirement",
        resource_id=requirement.id,
        trace_id=trace_id,
        details={"workspace_retention_policy": requirement.workspace_retention_policy},
    )
    await session.commit()
    await _remove_requirement_runtime(request, requirement)
    return ApiResponse(
        data={
            "deleted": True,
            "requirement_id": requirement.id,
            "workspace_retention_policy": requirement.workspace_retention_policy,
        }
    )


@router.get("/{requirement_id}/pipeline", response_model=ApiResponse[PipelineRead])
async def requirement_pipeline(
    requirement_id: int, user: CurrentUser, session: SessionDep
) -> ApiResponse[PipelineRead]:
    requirement = await get_requirement(session, user, requirement_id)
    pipeline = await session.scalar(select(Pipeline).where(Pipeline.requirement_id == requirement.id))
    if pipeline is None:
        raise ConflictError("Requirement pipeline is missing")
    history = list(
        (
            await session.scalars(
                select(StageHistory).where(StageHistory.pipeline_id == pipeline.id).order_by(StageHistory.id)
            )
        ).all()
    )
    return ApiResponse(
        data=PipelineRead(
            requirement_id=requirement.id,
            current_stage=pipeline.current_stage,
            run_status=pipeline.run_status,
            resource_version=requirement.version,
            history=[
                {
                    "id": item.id,
                    "from_stage": item.from_stage,
                    "to_stage": item.to_stage,
                    "trigger": item.trigger,
                    "operator_type": item.operator_type,
                    "operator_id": item.operator_id,
                    "reason": item.reason,
                    "artifact_versions": item.artifact_versions,
                    "created_at": item.created_at,
                }
                for item in history
            ],
        )
    )


def _actions_for(requirement: Requirement, user: User) -> list[str]:
    if requirement.run_status == RunStatus.CANCELLED.value:
        return []
    actions: list[str] = []
    stage = PipelineState(requirement.stage)
    roles = set(user.roles)
    if stage == PipelineState.REQUIREMENT_DRAFT and roles.intersection({"admin", "pm"}):
        actions.extend(["edit", "submit", "cancel"])
    elif stage == PipelineState.REQUIREMENT_CLARIFICATION and roles.intersection({"admin", "pm"}):
        actions.extend(
            [
                "edit",
                "generate_clarification",
                "answer_clarification",
                "confirm_clarification",
                "reopen_clarification",
            ]
        )
    elif stage in AUTOMATED_STATES and roles.intersection({"admin", "developer", "pm", "qa"}):
        actions.append("start_task")
    for gate, config in GATE_CONFIG.items():
        if stage == config["stage"] and ("admin" in roles or roles.intersection(config["roles"])):
            actions.extend([f"approve:{gate}", f"reject:{gate}", f"transfer:{gate}"])
    if requirement.run_status in {RunStatus.RUNNING.value, RunStatus.IDLE.value}:
        actions.append("pause")
    elif requirement.run_status == RunStatus.PAUSED.value:
        actions.append("resume")
    return actions


@router.get("/{requirement_id}/actions", response_model=ApiResponse[list[str]])
async def requirement_actions(requirement_id: int, user: CurrentUser, session: SessionDep) -> ApiResponse[list[str]]:
    requirement = await get_requirement(session, user, requirement_id)
    return ApiResponse(data=_actions_for(requirement, user))


@router.get("/{requirement_id}/events")
async def requirement_events(
    requirement_id: int,
    request: Request,
    user: CurrentUser,
    session: SessionDep,
) -> EventSourceResponse:
    requirement = await get_requirement(session, user, requirement_id)

    async def stream() -> AsyncIterator[dict[str, str]]:
        last_version = -1
        while not await request.is_disconnected():
            await session.refresh(requirement)
            if requirement.version != last_version:
                last_version = requirement.version
                yield {
                    "event": "requirement.updated",
                    "data": RequirementRead.model_validate(requirement).model_dump_json(),
                    "id": str(last_version),
                }
            await asyncio.sleep(2)

    return EventSourceResponse(stream())


@router.post("/{requirement_id}/clarification/generate", response_model=ApiResponse[AgentTaskRead])
async def generate_clarification(
    requirement_id: int,
    session: SessionDep,
    trace_id: TraceId,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[AgentTaskRead]:
    requirement = await get_requirement(session, user, requirement_id)
    if requirement.stage != PipelineState.REQUIREMENT_CLARIFICATION.value:
        raise InvalidStateError("Clarification can only be generated during requirement clarification")
    task, created = await create_agent_task(
        session,
        requirement,
        task_type="clarification_generate",
        idempotency_key=idempotency_key or uuid4().hex,
        input_summary=f"Generate clarification questions for requirement {requirement.id}",
        agent_version_id=requirement.requirement_agent_version_id,
        requested_by=user.id,
    )
    if created:
        add_audit_log(
            session,
            tenant_id=user.tenant_id,
            actor_id=user.id,
            action="clarification.generate",
            resource_type="agent_task",
            resource_id=task.id,
            trace_id=trace_id,
        )
        await session.commit()
        await session.refresh(task)
    return ApiResponse(data=AgentTaskRead.model_validate(task))


@router.get("/{requirement_id}/clarification/rounds", response_model=ApiResponse[list[dict]])
async def clarification_rounds(requirement_id: int, user: CurrentUser, session: SessionDep) -> ApiResponse[list[dict]]:
    requirement = await get_requirement(session, user, requirement_id)
    rounds = list(
        (
            await session.scalars(
                select(ClarificationRound)
                .where(ClarificationRound.requirement_id == requirement.id)
                .order_by(ClarificationRound.round_no)
            )
        ).all()
    )
    result: list[dict] = []
    for round_item in rounds:
        questions = list(
            (
                await session.scalars(
                    select(ClarificationQuestion).where(ClarificationQuestion.round_id == round_item.id)
                )
            ).all()
        )
        question_payload: list[dict] = []
        for question in questions:
            answers = list(
                (
                    await session.scalars(
                        select(ClarificationAnswer).where(ClarificationAnswer.question_id == question.id)
                    )
                ).all()
            )
            question_payload.append(
                {
                    "id": question.id,
                    "question": question.question,
                    "type": question.question_type,
                    "required": question.required,
                    "options": question.options,
                    "ai_recommendation": question.ai_recommendation,
                    "answers": [
                        {"user_id": answer.user_id, "answer": answer.answer, "created_at": answer.created_at}
                        for answer in answers
                    ],
                }
            )
        result.append(
            {
                "id": round_item.id,
                "round_no": round_item.round_no,
                "status": round_item.status,
                "questions": question_payload,
                "created_at": round_item.created_at,
            }
        )
    return ApiResponse(data=result)


@router.post("/{requirement_id}/clarification/answers", response_model=ApiResponse[dict])
async def submit_clarification_answers(
    requirement_id: int,
    payload: ClarificationAnswersRequest,
    session: SessionDep,
    trace_id: TraceId,
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[dict]:
    requirement = await get_requirement(session, user, requirement_id)
    _require_version(requirement, payload.resource_version)
    if requirement.stage != PipelineState.REQUIREMENT_CLARIFICATION.value:
        raise InvalidStateError("Answers can only be submitted during requirement clarification")
    round_item = await session.scalar(
        select(ClarificationRound)
        .where(ClarificationRound.requirement_id == requirement.id)
        .order_by(ClarificationRound.round_no.desc())
        .limit(1)
    )
    if round_item is None or round_item.status != "pending_answers":
        raise InvalidStateError("There is no clarification round waiting for answers")
    questions = list(
        (
            await session.scalars(select(ClarificationQuestion).where(ClarificationQuestion.round_id == round_item.id))
        ).all()
    )
    question_by_id = {item.id: item for item in questions}
    answers_by_id = {item.question_id: item.answer for item in payload.answers}
    if not set(answers_by_id).issubset(question_by_id):
        raise ConflictError("An answer references a question outside the current round")
    missing = [item.id for item in questions if item.required and item.id not in answers_by_id]
    if missing:
        raise ConflictError(f"Required clarification questions are unanswered: {missing}")
    session.add_all(
        [
            ClarificationAnswer(question_id=question_id, user_id=user.id, answer=answer)
            for question_id, answer in answers_by_id.items()
        ]
    )
    round_item.status = "answered"
    requirement.version += 1
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="clarification.answers.submit",
        resource_type="clarification_round",
        resource_id=round_item.id,
        trace_id=trace_id,
    )
    await session.commit()
    return ApiResponse(
        data={"round_id": round_item.id, "status": round_item.status, "resource_version": requirement.version}
    )


@router.post("/{requirement_id}/clarification/confirm", response_model=ApiResponse[RequirementRead])
async def confirm_clarification(
    requirement_id: int,
    payload: ClarificationConfirmRequest,
    session: SessionDep,
    trace_id: TraceId,
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[RequirementRead]:
    requirement = await get_requirement(session, user, requirement_id)
    _require_version(requirement, payload.resource_version)
    if requirement.stage != PipelineState.REQUIREMENT_CLARIFICATION.value:
        raise InvalidStateError("Requirement is not in clarification")
    latest_round = await session.scalar(
        select(ClarificationRound)
        .where(ClarificationRound.requirement_id == requirement.id)
        .order_by(ClarificationRound.round_no.desc())
        .limit(1)
    )
    if latest_round is None or latest_round.status != "answered":
        raise InvalidStateError("The latest clarification round must be answered before confirmation")
    question_rows = list(
        (
            await session.execute(
                select(ClarificationQuestion, ClarificationRound.round_no)
                .join(ClarificationRound, ClarificationRound.id == ClarificationQuestion.round_id)
                .where(ClarificationRound.requirement_id == requirement.id)
                .order_by(ClarificationRound.round_no, ClarificationQuestion.id)
            )
        ).all()
    )
    question_ids = [question.id for question, _ in question_rows]
    answers = (
        list(
            (
                await session.scalars(
                    select(ClarificationAnswer)
                    .where(ClarificationAnswer.question_id.in_(question_ids))
                    .order_by(ClarificationAnswer.id)
                )
            ).all()
        )
        if question_ids
        else []
    )
    latest_answers = {answer.question_id: answer.answer for answer in answers}
    confirmed_answers = []
    for question, round_no in question_rows:
        if question.id not in latest_answers:
            continue
        raw_answer = latest_answers[question.id]
        display_answer, labels = _resolved_answer(question, raw_answer)
        confirmed_answers.append(
            {
                "question_id": question.id,
                "round_no": round_no,
                "question": question.question,
                "answer": display_answer,
                "answer_value": raw_answer,
                "answer_labels": labels,
            }
        )
    submitted_document = (
        dict(payload.requirement_document) if isinstance(payload.requirement_document, dict) else {}
    )
    clarification_summary = str(
        submitted_document.get("clarification_summary") or requirement.description
    ).strip()
    requirement_document = {
        **submitted_document,
        "title": requirement.title,
        "description": requirement.description,
        "priority": requirement.priority,
        "repository_ids": await _repository_ids(session, requirement.id),
        "summary": clarification_summary,
        "clarification_summary": clarification_summary,
        "confirmed_answers": confirmed_answers,
    }
    latest_round.status = "confirmed"
    artifact_version = await add_artifact_version(
        session,
        requirement,
        artifact_type="requirement_document",
        content=requirement_document,
        source="user_confirmed_agent_output",
        created_by=user.id,
    )
    await transition_requirement(
        session,
        requirement,
        action="clarification_confirmed",
        operator_type="user",
        operator_id=user.id,
        artifact_versions={"requirement_document": artifact_version.version},
    )
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="clarification.confirm",
        resource_type="requirement",
        resource_id=requirement.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(requirement)
    return ApiResponse(data=await _requirement_read(session, requirement))


@router.post("/{requirement_id}/clarification/reopen", response_model=ApiResponse[dict])
async def reopen_clarification(
    requirement_id: int,
    payload: ResourceVersionRequest,
    session: SessionDep,
    trace_id: TraceId,
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[dict]:
    """Reset the latest confirmed clarification round for selective re-answering."""
    requirement = await get_requirement(session, user, requirement_id)
    _require_version(requirement, payload.resource_version)
    if requirement.stage != PipelineState.REQUIREMENT_CLARIFICATION.value:
        raise InvalidStateError("Clarification can only be reopened during requirement clarification")
    latest_round = await session.scalar(
        select(ClarificationRound)
        .where(ClarificationRound.requirement_id == requirement.id)
        .order_by(ClarificationRound.round_no.desc())
        .limit(1)
    )
    if latest_round is None or latest_round.status != "confirmed":
        raise InvalidStateError("Only a confirmed clarification round can be reopened")
    question_ids = list(
        await session.scalars(select(ClarificationQuestion.id).where(ClarificationQuestion.round_id == latest_round.id))
    )
    if question_ids:
        await session.execute(delete(ClarificationAnswer).where(ClarificationAnswer.question_id.in_(question_ids)))
    latest_round.status = "pending_answers"
    requirement.version += 1
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="clarification.reopen",
        resource_type="clarification_round",
        resource_id=latest_round.id,
        trace_id=trace_id,
    )
    await session.commit()
    return ApiResponse(
        data={
            "round_id": latest_round.id,
            "status": latest_round.status,
            "resource_version": requirement.version,
        }
    )


@router.get("/{requirement_id}/artifacts", response_model=ApiResponse[list[dict]])
async def list_artifacts(requirement_id: int, user: CurrentUser, session: SessionDep) -> ApiResponse[list[dict]]:
    requirement = await get_requirement(session, user, requirement_id)
    artifacts = list(
        (
            await session.scalars(
                select(Artifact).where(Artifact.requirement_id == requirement.id).order_by(Artifact.artifact_type)
            )
        ).all()
    )
    return ApiResponse(
        data=[
            {
                "id": artifact.id,
                "type": artifact.artifact_type,
                "current_version": artifact.current_version,
                "created_at": artifact.created_at,
                "updated_at": artifact.updated_at,
            }
            for artifact in artifacts
        ]
    )


@router.get("/{requirement_id}/artifacts/{artifact_type}/versions", response_model=ApiResponse[list[dict]])
async def artifact_versions(
    requirement_id: int,
    artifact_type: str,
    user: CurrentUser,
    session: SessionDep,
) -> ApiResponse[list[dict]]:
    requirement = await get_requirement(session, user, requirement_id)
    artifact, _ = await get_artifact(session, requirement.id, artifact_type)
    versions = list(
        (
            await session.scalars(
                select(ArtifactVersion)
                .where(ArtifactVersion.artifact_id == artifact.id)
                .order_by(ArtifactVersion.version.desc())
            )
        ).all()
    )
    return ApiResponse(
        data=[
            {
                "version": item.version,
                "content": item.content,
                "source": item.source,
                "source_ref": item.source_ref,
                "checksum": item.checksum,
                "created_by": item.created_by,
                "created_at": item.created_at,
            }
            for item in versions
        ]
    )


@router.post("/{requirement_id}/artifacts/{artifact_type}/revise", response_model=ApiResponse[dict])
async def revise_artifact(
    requirement_id: int,
    artifact_type: str,
    payload: ArtifactReviseRequest,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[dict]:
    requirement = await get_requirement(session, user, requirement_id)
    _require_version(requirement, payload.resource_version)
    allowed = {
        PipelineState.DEVELOPMENT_DOCUMENT_REVIEW.value: "development_document",
        PipelineState.DEVELOPMENT_REPORT_REVIEW.value: "development_report",
    }
    if allowed.get(requirement.stage) != artifact_type:
        raise InvalidStateError("This artifact cannot be revised at the current stage")
    version = await add_artifact_version(
        session,
        requirement,
        artifact_type=artifact_type,
        content=payload.content,
        source="human_revision",
        created_by=user.id,
    )
    requirement.version += 1
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="artifact.revise",
        resource_type="artifact",
        resource_id=version.artifact_id,
        trace_id=trace_id,
        details={"version": version.version, "comment": payload.comment},
    )
    await session.commit()
    return ApiResponse(
        data={
            "artifact_type": artifact_type,
            "version": version.version,
            "checksum": version.checksum,
            "resource_version": requirement.version,
        }
    )


@router.post("/{requirement_id}/reviews/{gate}", response_model=ApiResponse[dict])
async def review_gate(
    requirement_id: int,
    gate: ReviewGate,
    payload: ReviewRequest,
    request: Request,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> ApiResponse[dict]:
    scoped_key = f"{user.tenant_id}:{idempotency_key}" if idempotency_key else None
    if scoped_key:
        existing = await session.scalar(select(ReviewRecord).where(ReviewRecord.idempotency_key == scoped_key))
        if existing is not None:
            return ApiResponse(
                data={
                    "review_id": existing.id,
                    "action": existing.action,
                    "stage": existing.to_stage,
                    "resource_version": existing.resource_version + 1,
                }
            )
    requirement = await get_requirement(session, user, requirement_id)
    _require_version(requirement, payload.resource_version)
    config = GATE_CONFIG[gate]
    if requirement.stage != config["stage"].value:
        raise InvalidStateError(f"Gate '{gate}' is not active at stage '{requirement.stage}'")
    if "admin" not in user.roles and not set(user.roles).intersection(config["roles"]):
        raise PermissionDeniedError(f"Current role cannot review the {gate} gate")
    if payload.action == "reject" and not payload.comment.strip():
        raise ConflictError("A rejection comment is required")
    if payload.action == "transfer" and payload.assignee_id is None:
        raise ConflictError("An assignee is required when transferring a review")
    if gate == "final_acceptance" and payload.action == "approve" and not payload.final_confirmation:
        raise ConflictError("Final acceptance requires explicit second confirmation")
    artifact_type = config["artifact"]
    if gate == "final_acceptance":
        for candidate in ("test_plan", "test_cases", "development_report"):
            artifact_id = await session.scalar(
                select(Artifact.id).where(
                    Artifact.requirement_id == requirement.id,
                    Artifact.artifact_type == candidate,
                )
            )
            if artifact_id is not None:
                artifact_type = candidate
                break
    artifact, current_version = await get_artifact(session, requirement.id, artifact_type)
    if current_version.version != payload.artifact_version:
        raise ConflictError(f"Review must reference the current artifact version {current_version.version}")
    from_stage = requirement.stage
    to_stage = from_stage
    generated_task_id: int | None = None
    delivery_workspace_count = 0
    if payload.action in {"approve", "reject"}:
        if gate == "final_acceptance" and payload.action == "approve":
            try:
                pushed_workspaces = await push_requirement_workspaces(session, requirement)
                delivery_workspace_count = len(pushed_workspaces)
            except ExternalDependencyError:
                requirement.run_status = RunStatus.FAILED.value
                requirement.version += 1
                pipeline = await session.scalar(select(Pipeline).where(Pipeline.requirement_id == requirement.id))
                if pipeline is not None:
                    pipeline.run_status = RunStatus.FAILED.value
                add_audit_log(
                    session,
                    tenant_id=user.tenant_id,
                    actor_id=user.id,
                    action="delivery.push_failed",
                    resource_type="requirement",
                    resource_id=requirement.id,
                    trace_id=trace_id,
                    details={"stage": requirement.stage, "retry_allowed": True},
                )
                await session.commit()
                raise
        target = await transition_requirement(
            session,
            requirement,
            action=payload.action,
            operator_type="user",
            operator_id=user.id,
            reason=payload.comment,
            artifact_versions={artifact_type: payload.artifact_version},
        )
        to_stage = target.value
    else:
        assignee = await session.scalar(
            select(User).where(
                User.id == payload.assignee_id,
                User.tenant_id == user.tenant_id,
                User.status == "active",
            )
        )
        if assignee is None:
            raise NotFoundError("Review assignee not found")
        requirement.assignee_id = assignee.id
        requirement.version += 1
    if gate == "final_acceptance" and payload.action == "approve":
        accepted = {
            item.artifact_type: item.current_version
            for item in (await session.scalars(select(Artifact).where(Artifact.requirement_id == requirement.id))).all()
        }
        await add_artifact_version(
            session,
            requirement,
            artifact_type="acceptance_record",
            content={
                "accepted": True,
                "comment": payload.comment,
                "artifact_versions": accepted,
                "reviewer_id": user.id,
            },
            source="user",
            created_by=user.id,
        )
        add_audit_log(
            session,
            tenant_id=user.tenant_id,
            actor_id=user.id,
            action="delivery.push_succeeded",
            resource_type="requirement",
            resource_id=requirement.id,
            trace_id=trace_id,
            details={"workspace_count": delivery_workspace_count},
        )
    record = ReviewRecord(
        tenant_id=user.tenant_id,
        requirement_id=requirement.id,
        gate=gate,
        action=payload.action,
        artifact_version=payload.artifact_version,
        reviewer_id=user.id,
        assignee_id=payload.assignee_id,
        comment=payload.comment,
        from_stage=from_stage,
        to_stage=to_stage,
        resource_version=payload.resource_version,
        idempotency_key=scoped_key,
    )
    session.add(record)
    await session.flush()
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action=f"review.{gate}.{payload.action}",
        resource_type="review_record",
        resource_id=record.id,
        trace_id=trace_id,
        details={
            "artifact_id": artifact.id,
            "artifact_version": payload.artifact_version,
            "generated_task_id": generated_task_id,
        },
    )
    await session.commit()
    if requirement.stage == PipelineState.COMPLETED.value:
        await _remove_requirement_runtime(request, requirement)
    return ApiResponse(
        data={
            "review_id": record.id,
            "action": record.action,
            "stage": requirement.stage,
            "resource_version": requirement.version,
            "agent_task_id": generated_task_id,
        }
    )


@router.get("/{requirement_id}/reviews", response_model=ApiResponse[list[dict]])
async def review_history(requirement_id: int, user: CurrentUser, session: SessionDep) -> ApiResponse[list[dict]]:
    requirement = await get_requirement(session, user, requirement_id)
    reviews = list(
        (
            await session.scalars(
                select(ReviewRecord).where(ReviewRecord.requirement_id == requirement.id).order_by(ReviewRecord.id)
            )
        ).all()
    )
    return ApiResponse(
        data=[
            {
                "id": item.id,
                "gate": item.gate,
                "action": item.action,
                "artifact_version": item.artifact_version,
                "reviewer_id": item.reviewer_id,
                "assignee_id": item.assignee_id,
                "comment": item.comment,
                "from_stage": item.from_stage,
                "to_stage": item.to_stage,
                "resource_version": item.resource_version,
                "created_at": item.created_at,
            }
            for item in reviews
        ]
    )


@router.post("/{requirement_id}/tasks", response_model=ApiResponse[AgentTaskRead], status_code=201)
async def start_task(
    requirement_id: int,
    payload: TaskCreateRequest,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> ApiResponse[AgentTaskRead]:
    requirement = await get_requirement(session, user, requirement_id)
    stage = PipelineState(requirement.stage)
    expected_task_type = await _task_type_for_stage(session, requirement)
    if expected_task_type is None:
        raise InvalidStateError(f"No Agent task can be started at stage '{stage.value}'")
    if payload.task_type is not None and payload.task_type != expected_task_type:
        raise ConflictError(f"Task type for this stage must be '{expected_task_type}'")
    selected_agent_version_id = (
        requirement.development_document_agent_version_id
        if expected_task_type == "development_document_generation"
        else requirement.development_agent_version_id
    )
    task, created = await create_agent_task(
        session,
        requirement,
        task_type=expected_task_type,
        idempotency_key=idempotency_key or uuid4().hex,
        input_summary=payload.input_summary,
        agent_version_id=selected_agent_version_id,
        requested_by=user.id,
    )
    if created:
        add_audit_log(
            session,
            tenant_id=user.tenant_id,
            actor_id=user.id,
            action="agent_task.start",
            resource_type="agent_task",
            resource_id=task.id,
            trace_id=trace_id,
            details={"stage": requirement.stage, "task_type": task.task_type},
        )
        await session.commit()
        await session.refresh(task)
    return ApiResponse(data=AgentTaskRead.model_validate(task))


@router.get("/{requirement_id}/tasks", response_model=ApiResponse[list[AgentTaskRead]])
async def list_tasks(requirement_id: int, user: CurrentUser, session: SessionDep) -> ApiResponse[list[AgentTaskRead]]:
    requirement = await get_requirement(session, user, requirement_id)
    tasks = list(
        (
            await session.scalars(
                select(AgentTask)
                .where(
                    AgentTask.requirement_id == requirement.id,
                    ~AgentTask.task_type.like("subagent:%"),
                )
                .order_by(AgentTask.id.desc())
            )
        ).all()
    )
    return ApiResponse(data=[AgentTaskRead.model_validate(item) for item in tasks])


@router.get("/{requirement_id}/agent-sessions", response_model=ApiResponse[list[AgentSessionRead]])
async def list_agent_sessions(
    requirement_id: int,
    user: CurrentUser,
    session: SessionDep,
) -> ApiResponse[list[AgentSessionRead]]:
    requirement = await get_requirement(session, user, requirement_id)
    items = list(
        (
            await session.scalars(
                select(AgentSession)
                .where(
                    AgentSession.requirement_id == requirement.id,
                    AgentSession.role_type.in_(("requirement_clarification", "development")),
                )
                .order_by(AgentSession.id)
            )
        ).all()
    )
    return ApiResponse(data=[AgentSessionRead.model_validate(item) for item in items])
