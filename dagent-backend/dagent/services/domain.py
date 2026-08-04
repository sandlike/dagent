from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dagent.api.errors import ConflictError, InvalidStateError, NotFoundError
from dagent.api.schemas.artifacts import normalize_artifact_content
from dagent.models import (
    AgentDefinition,
    AgentSession,
    AgentTask,
    AgentVersion,
    Artifact,
    ArtifactVersion,
    Pipeline,
    Project,
    ProjectMember,
    Requirement,
    StageHistory,
    User,
)
from dagent.pipeline.state_machine import PipelineState, RunStatus, next_state, run_status_for

TASK_ROLE_TYPES: dict[str, str | None] = {
    "clarification_generate": "requirement_clarification",
    "development_document_generation": "development",
    "development": "development",
    "failure_fix": "development",
    "test_plan_generation": "development",
}

TASK_MODES = {
    "clarification_generate": "requirement_clarification",
    "development_document_generation": "development_document",
    "development": "implementation",
    "failure_fix": "failure_fix",
    "test_plan_generation": "test_plan",
}


async def get_project(session: AsyncSession, user: User, project_id: int) -> Project:
    query = select(Project).where(Project.id == project_id, Project.tenant_id == user.tenant_id)
    if "admin" not in user.roles:
        query = query.join(ProjectMember).where(ProjectMember.user_id == user.id)
    project = await session.scalar(query)
    if project is None:
        raise NotFoundError("Project not found")
    return project


async def get_requirement(session: AsyncSession, user: User, requirement_id: int) -> Requirement:
    query = (
        select(Requirement)
        .join(Project, Project.id == Requirement.project_id)
        .where(Requirement.id == requirement_id, Requirement.tenant_id == user.tenant_id)
    )
    if "admin" not in user.roles:
        query = query.join(ProjectMember, ProjectMember.project_id == Project.id).where(
            ProjectMember.user_id == user.id
        )
    requirement = await session.scalar(query)
    if requirement is None:
        raise NotFoundError("Requirement not found")
    return requirement


async def transition_requirement(
    session: AsyncSession,
    requirement: Requirement,
    *,
    action: str,
    operator_type: str,
    operator_id: int | None,
    reason: str = "",
    artifact_versions: dict[str, int] | None = None,
) -> PipelineState:
    current = PipelineState(requirement.stage)
    try:
        target = next_state(current, action)
    except ValueError as exc:
        raise InvalidStateError(str(exc)) from exc

    pipeline = await session.scalar(select(Pipeline).where(Pipeline.requirement_id == requirement.id).with_for_update())
    if pipeline is None:
        raise ConflictError("Requirement pipeline is missing")

    target_run_status = run_status_for(target)
    requirement.stage = target.value
    requirement.run_status = target_run_status.value
    requirement.version += 1
    pipeline.current_stage = target.value
    pipeline.run_status = target_run_status.value
    if target == PipelineState.COMPLETED:
        requirement.completed_at = datetime.now(UTC)

    session.add(
        StageHistory(
            tenant_id=requirement.tenant_id,
            pipeline_id=pipeline.id,
            from_stage=current.value,
            to_stage=target.value,
            trigger=action,
            operator_type=operator_type,
            operator_id=operator_id,
            reason=reason,
            artifact_versions=artifact_versions or {},
        )
    )
    return target


async def add_artifact_version(
    session: AsyncSession,
    requirement: Requirement,
    *,
    artifact_type: str,
    content: Any,
    source: str,
    created_by: int | None,
    source_ref: str | None = None,
) -> ArtifactVersion:
    content = normalize_artifact_content(artifact_type, content)
    artifact = await session.scalar(
        select(Artifact)
        .where(Artifact.requirement_id == requirement.id, Artifact.artifact_type == artifact_type)
        .with_for_update()
    )
    if artifact is None:
        artifact = Artifact(
            tenant_id=requirement.tenant_id,
            requirement_id=requirement.id,
            artifact_type=artifact_type,
        )
        session.add(artifact)
        await session.flush()

    serialized = json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    artifact.current_version += 1
    version = ArtifactVersion(
        artifact_id=artifact.id,
        version=artifact.current_version,
        content=content,
        source=source,
        source_ref=source_ref,
        checksum=hashlib.sha256(serialized.encode("utf-8")).hexdigest(),
        created_by=created_by,
    )
    session.add(version)
    await session.flush()
    return version


async def get_artifact(
    session: AsyncSession, requirement_id: int, artifact_type: str
) -> tuple[Artifact, ArtifactVersion]:
    artifact = await session.scalar(
        select(Artifact).where(
            Artifact.requirement_id == requirement_id,
            Artifact.artifact_type == artifact_type,
        )
    )
    if artifact is None:
        raise NotFoundError(f"Artifact '{artifact_type}' not found")
    version = await session.scalar(
        select(ArtifactVersion).where(
            ArtifactVersion.artifact_id == artifact.id,
            ArtifactVersion.version == artifact.current_version,
        )
    )
    if version is None:
        raise ConflictError(f"Artifact '{artifact_type}' has no current version")
    return artifact, version


async def create_agent_task(
    session: AsyncSession,
    requirement: Requirement,
    *,
    task_type: str,
    idempotency_key: str,
    input_summary: str,
    agent_version_id: int | None,
    requested_by: int,
) -> tuple[AgentTask, bool]:
    locked_requirement = await session.scalar(
        select(Requirement).where(Requirement.id == requirement.id).with_for_update()
    )
    if locked_requirement is None:
        raise NotFoundError("Requirement not found")
    requirement = locked_requirement
    existing = await session.scalar(
        select(AgentTask).where(
            AgentTask.tenant_id == requirement.tenant_id,
            AgentTask.idempotency_key == idempotency_key,
        )
    )
    if existing is not None:
        return existing, False
    if requirement.run_status in {RunStatus.PAUSED.value, RunStatus.CANCELLED.value}:
        raise InvalidStateError(f"Cannot start a task while requirement is {requirement.run_status}")
    if requirement.run_status == RunStatus.RUNNING.value:
        raise ConflictError("A task is already running for this requirement")

    if task_type not in TASK_ROLE_TYPES:
        raise ConflictError(f"Unsupported task type '{task_type}'")
    role_type = TASK_ROLE_TYPES[task_type]
    agent_session: AgentSession | None = None
    agent_version: AgentVersion | None = None
    agent_snapshot: dict[str, Any] = {}
    if agent_version_id is None:
        agent_version = await session.scalar(
            select(AgentVersion)
            .join(AgentDefinition, AgentDefinition.id == AgentVersion.agent_id)
            .where(
                AgentDefinition.tenant_id == requirement.tenant_id,
                AgentDefinition.role_type == role_type,
                AgentDefinition.status == "active",
                AgentVersion.status == "published",
            )
            .order_by(AgentDefinition.default_flag.desc(), AgentVersion.version.desc())
            .limit(1)
        )
        if agent_version is None:
            raise ConflictError(f"No published {role_type} Agent version is available")
        agent_version_id = agent_version.id
    else:
        agent_version = await session.get(AgentVersion, agent_version_id)
        if agent_version is None:
            raise ConflictError("Agent version no longer exists")

    if agent_version is None:
        raise ConflictError("Agent version no longer exists")
    agent = await session.get(AgentDefinition, agent_version.agent_id)
    if agent is None or agent.role_type != role_type:
        raise ConflictError(f"Agent version is not a {role_type} Agent")
    agent_snapshot = {
        "definition_id": agent.id,
        "role_type": agent.role_type,
        "name": agent.name,
        "version_id": agent_version.id,
        "version": agent_version.version,
        "style": agent_version.style,
        "prompt_ref": agent_version.prompt_ref,
        "skill_policy": agent_version.skill_policy,
        "mcp_policy": agent_version.mcp_policy,
        "tool_policy": agent_version.tool_policy,
    }
    agent_session = await _get_or_create_agent_session(
        session,
        requirement,
        role_type=role_type,
        agent_version_id=agent_version.id,
    )

    task = AgentTask(
        tenant_id=requirement.tenant_id,
        requirement_id=requirement.id,
        session_id=agent_session.id if agent_session else None,
        stage=requirement.stage,
        task_type=task_type,
        idempotency_key=idempotency_key,
        input_summary=input_summary,
        agent_version_id=agent_version_id,
        requested_by=requested_by,
        checkpoint={
            "agent_snapshot": agent_snapshot,
            "task_mode": TASK_MODES[task_type],
            "workspace_lock": f"requirement:{requirement.id}",
        },
    )
    requirement.run_status = RunStatus.RUNNING.value
    pipeline = await session.scalar(select(Pipeline).where(Pipeline.requirement_id == requirement.id))
    if pipeline is None:
        raise ConflictError("Requirement pipeline is missing")
    pipeline.run_status = RunStatus.RUNNING.value
    session.add(task)
    await session.flush()
    return task, True


async def _get_or_create_agent_session(
    session: AsyncSession,
    requirement: Requirement,
    *,
    role_type: str,
    agent_version_id: int,
) -> AgentSession:
    active = await session.scalar(
        select(AgentSession)
        .where(
            AgentSession.requirement_id == requirement.id,
            AgentSession.role_type == role_type,
            AgentSession.status == "active",
        )
        .order_by(AgentSession.id.desc())
        .with_for_update()
    )
    if active is not None and active.agent_version_id == agent_version_id:
        return active

    previous_session_id = active.id if active else None
    if active is not None:
        active.status = "agent_version_changed"

    legacy_opencode_session_id = ""
    if active is None:
        legacy_tasks = list(
            (
                await session.scalars(
                    select(AgentTask)
                    .where(AgentTask.requirement_id == requirement.id)
                    .order_by(AgentTask.id.desc())
                    .limit(100)
                )
            ).all()
        )
        for legacy_task in legacy_tasks:
            expected_role = TASK_ROLE_TYPES.get(legacy_task.task_type)
            checkpoint = legacy_task.checkpoint if isinstance(legacy_task.checkpoint, dict) else {}
            candidate = str(checkpoint.get("opencode_session_id") or "")
            if expected_role == role_type and candidate:
                legacy_opencode_session_id = candidate
                break

    agent_session = AgentSession(
        tenant_id=requirement.tenant_id,
        requirement_id=requirement.id,
        role_type=role_type,
        opencode_session_id=legacy_opencode_session_id,
        agent_version_id=agent_version_id,
        status="active",
        previous_session_id=previous_session_id,
    )
    session.add(agent_session)
    await session.flush()
    return agent_session


async def replace_agent_session(
    session: AsyncSession,
    task: AgentTask,
    *,
    reason: str,
) -> AgentSession:
    if task.session_id is None or task.agent_version_id is None:
        raise ConflictError("This task is not linked to an Agent session")
    current = await session.get(AgentSession, task.session_id)
    if current is None:
        raise ConflictError("Agent session no longer exists")
    current.status = reason
    replacement = AgentSession(
        tenant_id=current.tenant_id,
        requirement_id=current.requirement_id,
        role_type=current.role_type,
        opencode_session_id="",
        agent_version_id=task.agent_version_id,
        status="active",
        previous_session_id=current.id,
    )
    session.add(replacement)
    await session.flush()
    task.session_id = replacement.id
    return replacement
