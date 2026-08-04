from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, Query, Request
from pydantic import ValidationError
from sqlalchemy import func, select

from dagent.api.deps import (
    CurrentUser,
    SessionDep,
    TraceId,
    verify_agent_callback_token,
)
from dagent.api.errors import ConflictError, InvalidStateError, NotFoundError
from dagent.api.schemas.artifacts import (
    TASK_ARTIFACT_TYPES,
    format_validation_error,
    normalize_artifact_content,
    reconcile_development_report,
    validate_development_report,
)
from dagent.api.schemas.common import ApiResponse, Page
from dagent.api.schemas.domain import AgentTaskRead, TaskResultRequest
from dagent.models import (
    AgentTask,
    AgentTaskLog,
    ClarificationQuestion,
    ClarificationRound,
    Pipeline,
    Requirement,
)
from dagent.pipeline.state_machine import RunStatus
from dagent.services.audit import add_audit_log
from dagent.services.domain import (
    add_artifact_version,
    create_agent_task,
    get_requirement,
    transition_requirement,
)

router = APIRouter()

async def _task_for_user(session: SessionDep, user: CurrentUser, task_id: int) -> tuple[AgentTask, Requirement]:
    task = await session.scalar(
        select(AgentTask).where(
            AgentTask.id == task_id,
            AgentTask.tenant_id == user.tenant_id,
            ~AgentTask.task_type.like("subagent:%"),
        )
    )
    if task is None:
        raise NotFoundError("Agent task not found")
    requirement = await get_requirement(session, user, task.requirement_id)
    return task, requirement


@router.get("/agent-tasks/{task_id}", response_model=ApiResponse[AgentTaskRead])
async def task_detail(task_id: int, user: CurrentUser, session: SessionDep) -> ApiResponse[AgentTaskRead]:
    task, _ = await _task_for_user(session, user, task_id)
    return ApiResponse(data=AgentTaskRead.model_validate(task))


@router.post("/agent-tasks/{task_id}/retry", response_model=ApiResponse[AgentTaskRead], status_code=201)
async def retry_task(
    task_id: int,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> ApiResponse[AgentTaskRead]:
    task, requirement = await _task_for_user(session, user, task_id)
    if task.status not in {"failed", "cancelled"}:
        raise InvalidStateError("Only failed or cancelled tasks can be retried")
    if requirement.stage != task.stage:
        raise ConflictError("Requirement stage changed; this task can no longer be retried")
    retry, created = await create_agent_task(
        session,
        requirement,
        task_type=task.task_type,
        idempotency_key=idempotency_key or uuid4().hex,
        input_summary=task.input_summary,
        agent_version_id=task.agent_version_id,
        requested_by=user.id,
    )
    if created:
        retry.checkpoint = {
            **task.checkpoint,
            **retry.checkpoint,
            "retry_of_task_id": task.id,
        }
        retry.retry_count = task.retry_count + 1
        add_audit_log(
            session,
            tenant_id=user.tenant_id,
            actor_id=user.id,
            action="agent_task.retry",
            resource_type="agent_task",
            resource_id=retry.id,
            trace_id=trace_id,
            details={"previous_task_id": task.id},
        )
        await session.commit()
        await session.refresh(retry)
    return ApiResponse(data=AgentTaskRead.model_validate(retry))


@router.post("/agent-tasks/{task_id}/cancel", response_model=ApiResponse[AgentTaskRead])
async def cancel_task(
    task_id: int,
    request: Request,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[AgentTaskRead]:
    task, requirement = await _task_for_user(session, user, task_id)
    if task.status not in {"queued", "running"}:
        raise InvalidStateError("Only queued or running tasks can be cancelled")
    task.status = "cancelled"
    task.completed_at = datetime.now(UTC)
    requirement.run_status = RunStatus.IDLE.value
    requirement.version += 1
    pipeline = await session.scalar(select(Pipeline).where(Pipeline.requirement_id == requirement.id))
    if pipeline:
        pipeline.run_status = RunStatus.IDLE.value
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="agent_task.cancel",
        resource_type="agent_task",
        resource_id=task.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(task)
    runtime = getattr(request.app.state, "agent_runtime", None)
    if runtime is not None:
        await runtime.abort_task(task.id)
    return ApiResponse(data=AgentTaskRead.model_validate(task))


@router.get("/agent-tasks/{task_id}/logs", response_model=ApiResponse[Page[dict]])
async def task_logs(
    task_id: int,
    user: CurrentUser,
    session: SessionDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
) -> ApiResponse[Page[dict]]:
    task, _ = await _task_for_user(session, user, task_id)
    total = await session.scalar(select(func.count(AgentTaskLog.id)).where(AgentTaskLog.task_id == task.id)) or 0
    logs = list(
        (
            await session.scalars(
                select(AgentTaskLog)
                .where(AgentTaskLog.task_id == task.id)
                .order_by(AgentTaskLog.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return ApiResponse(
        data=Page(
            items=[
                {
                    "id": item.id,
                    "level": item.level,
                    "message": item.message,
                    "created_at": item.created_at,
                }
                for item in logs
            ],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "/internal/agent-tasks/{task_id}/result",
    response_model=ApiResponse[AgentTaskRead],
    dependencies=[Depends(verify_agent_callback_token)],
)
async def record_task_result(
    task_id: int,
    payload: TaskResultRequest,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[AgentTaskRead]:
    task = await session.scalar(select(AgentTask).where(AgentTask.id == task_id).with_for_update())
    if task is None:
        raise NotFoundError("Agent task not found")
    if task.status == "succeeded" and payload.status == "succeeded":
        return ApiResponse(data=AgentTaskRead.model_validate(task))
    if task.status not in {"queued", "running"}:
        raise InvalidStateError(f"Cannot report a result for a {task.status} task")
    requirement = await session.scalar(
        select(Requirement).where(Requirement.id == task.requirement_id).with_for_update()
    )
    if requirement is None:
        raise NotFoundError("Task requirement not found")
    if task.stage != requirement.stage:
        raise ConflictError("Task result is stale because the requirement stage has changed")

    now = datetime.now(UTC)
    task.started_at = task.started_at or now
    task.output_summary = payload.output_summary
    if payload.checkpoint:
        task.checkpoint = {**task.checkpoint, **payload.checkpoint}
    task.error_message = payload.error_message
    task.completed_at = now
    for message in payload.logs:
        session.add(
            AgentTaskLog(
                tenant_id=task.tenant_id,
                task_id=task.id,
                level="error" if payload.status == "failed" else "info",
                message=message,
            )
        )

    pipeline = await session.scalar(select(Pipeline).where(Pipeline.requirement_id == requirement.id))
    if pipeline is None:
        raise ConflictError("Requirement pipeline is missing")
    if payload.status == "failed":
        if not payload.error_message.strip():
            raise ConflictError("A failed task result must include an error message")
        task.status = "failed"
        requirement.run_status = RunStatus.FAILED.value
        requirement.version += 1
        pipeline.run_status = RunStatus.FAILED.value
    elif task.task_type == "clarification_generate":
        if not payload.clarification_questions:
            raise ConflictError("Clarification generation must return at least one question")
        last_round_no = (
            await session.scalar(
                select(func.max(ClarificationRound.round_no)).where(ClarificationRound.requirement_id == requirement.id)
            )
            or 0
        )
        round_item = ClarificationRound(
            tenant_id=requirement.tenant_id,
            requirement_id=requirement.id,
            round_no=last_round_no + 1,
        )
        session.add(round_item)
        await session.flush()
        session.add_all(
            [
                ClarificationQuestion(
                    round_id=round_item.id,
                    question=item.question,
                    question_type=item.question_type,
                    required=item.required,
                    options=item.options,
                    ai_recommendation=item.ai_recommendation,
                )
                for item in payload.clarification_questions
            ]
        )
        task.status = "succeeded"
        requirement.run_status = RunStatus.WAITING_HUMAN.value
        requirement.version += 1
        pipeline.run_status = RunStatus.WAITING_HUMAN.value
    else:
        expected_artifact = TASK_ARTIFACT_TYPES.get(task.task_type)
        if expected_artifact is None:
            raise ConflictError(f"Unsupported task type '{task.task_type}'")
        if payload.artifact_type and payload.artifact_type != expected_artifact:
            raise ConflictError(f"Task must produce artifact type '{expected_artifact}'")
        if payload.artifact_content is None:
            raise ConflictError("A successful task result must include artifact content")
        try:
            normalized_content = normalize_artifact_content(expected_artifact, payload.artifact_content)
            if task.task_type in {"development", "failure_fix"}:
                if not isinstance(normalized_content, dict):
                    raise ValueError("Development result must be a JSON object")
                reconcile_development_report(normalized_content)
                validate_development_report(normalized_content)
            artifact_version = await add_artifact_version(
                session,
                requirement,
                artifact_type=expected_artifact,
                content=normalized_content,
                source="agent",
                source_ref=f"agent-task:{task.id}",
                created_by=None,
            )
        except ValidationError as exc:
            if task.task_type != "test_plan_generation":
                raise
            raise ConflictError(f"Test plan validation failed: {format_validation_error(exc)}") from exc
        except ValueError as exc:
            raise ConflictError(str(exc)) from exc
        artifact_versions = {expected_artifact: artifact_version.version}
        await transition_requirement(
            session,
            requirement,
            action="task_succeeded",
            operator_type="agent_task",
            operator_id=task.id,
            reason=payload.output_summary,
            artifact_versions=artifact_versions,
        )
        task.status = "succeeded"

    add_audit_log(
        session,
        tenant_id=task.tenant_id,
        actor_id=task.id,
        actor_type="agent_task",
        action=f"agent_task.{task.status}",
        resource_type="agent_task",
        resource_id=task.id,
        trace_id=trace_id,
        details={
            "stage": task.stage,
            "task_type": task.task_type,
            "session_id": task.session_id,
        },
    )
    await session.commit()
    await session.refresh(task)
    return ApiResponse(data=AgentTaskRead.model_validate(task))
