from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select

from dagent.api.deps import CurrentUser, SessionDep, TraceId, require_roles
from dagent.api.errors import ConflictError, ExternalDependencyError
from dagent.api.schemas.common import ApiResponse
from dagent.api.schemas.platform import (
    MergeCheckRequest,
    MergeCheckResult,
    MergeQueueRead,
    MergeQueueRequest,
    WorkspaceRead,
)
from dagent.models import MergeQueueEntry, Repository, RequirementWorkspace
from dagent.services.audit import add_audit_log
from dagent.services.domain import get_requirement
from dagent.services.workspaces import (
    WorkspaceManagerClient,
    get_workspace,
    resolve_repository_credential,
)

router = APIRouter()
developer_access = Depends(require_roles("developer"))


@router.get("/requirements/{requirement_id}/workspace", response_model=ApiResponse[list[WorkspaceRead]])
async def list_workspaces(
    requirement_id: int,
    user: CurrentUser,
    session: SessionDep,
) -> ApiResponse[list[WorkspaceRead]]:
    requirement = await get_requirement(session, user, requirement_id)
    items = list(
        (
            await session.scalars(
                select(RequirementWorkspace)
                .where(RequirementWorkspace.requirement_id == requirement.id)
                .order_by(RequirementWorkspace.repository_id)
            )
        ).all()
    )
    return ApiResponse(data=[WorkspaceRead.model_validate(item) for item in items])


async def _check(
    session: SessionDep,
    workspace: RequirementWorkspace,
    target_branch: str,
    *,
    lock_repository: bool = False,
) -> MergeCheckResult:
    query = select(Repository).where(Repository.id == workspace.repository_id)
    if lock_repository:
        query = query.with_for_update()
    repository = await session.scalar(query)
    if repository is None:
        raise ConflictError("Workspace repository no longer exists")
    credential = resolve_repository_credential(repository)
    result = await WorkspaceManagerClient(requirement_id=workspace.requirement_id).merge_check(
        workspace.path, target_branch, credential
    )
    return MergeCheckResult(
        workspace_id=workspace.id,
        can_merge=bool(result.get("can_merge")),
        target_branch=target_branch,
        conflict_files=list(result.get("conflict_files") or []),
        message=str(result.get("message") or ""),
    )


@router.post(
    "/requirements/{requirement_id}/merge-check",
    response_model=ApiResponse[MergeCheckResult],
    dependencies=[developer_access],
)
async def merge_check(
    requirement_id: int,
    payload: MergeCheckRequest,
    user: CurrentUser,
    session: SessionDep,
) -> ApiResponse[MergeCheckResult]:
    await get_requirement(session, user, requirement_id)
    workspace = await get_workspace(
        session,
        tenant_id=user.tenant_id,
        requirement_id=requirement_id,
        workspace_id=payload.workspace_id,
    )
    return ApiResponse(data=await _check(session, workspace, payload.target_branch or workspace.base_branch))


@router.get("/requirements/{requirement_id}/merge-queue", response_model=ApiResponse[list[MergeQueueRead]])
async def list_merge_queue(
    requirement_id: int,
    user: CurrentUser,
    session: SessionDep,
) -> ApiResponse[list[MergeQueueRead]]:
    requirement = await get_requirement(session, user, requirement_id)
    items = list(
        (
            await session.scalars(
                select(MergeQueueEntry)
                .where(MergeQueueEntry.requirement_id == requirement.id)
                .order_by(MergeQueueEntry.id.desc())
            )
        ).all()
    )
    return ApiResponse(data=[MergeQueueRead.model_validate(item) for item in items])


@router.post(
    "/requirements/{requirement_id}/merge-queue",
    response_model=ApiResponse[MergeQueueRead],
    dependencies=[developer_access],
)
async def enter_merge_queue(
    requirement_id: int,
    payload: MergeQueueRequest,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> ApiResponse[MergeQueueRead]:
    await get_requirement(session, user, requirement_id)
    workspace = await get_workspace(
        session,
        tenant_id=user.tenant_id,
        requirement_id=requirement_id,
        workspace_id=payload.workspace_id,
    )
    scoped_key = f"{user.tenant_id}:merge:{payload.idempotency_key or idempotency_key or uuid4().hex}"
    existing = await session.scalar(
        select(MergeQueueEntry).where(
            MergeQueueEntry.tenant_id == user.tenant_id,
            MergeQueueEntry.idempotency_key == scoped_key,
        )
    )
    if existing is not None:
        return ApiResponse(data=MergeQueueRead.model_validate(existing))
    target = payload.target_branch or workspace.base_branch
    # Serializing on the repository row makes later requests re-check the updated remote target.
    check = await _check(session, workspace, target, lock_repository=True)
    entry = MergeQueueEntry(
        tenant_id=user.tenant_id,
        requirement_id=requirement_id,
        workspace_id=workspace.id,
        target_branch=target,
        status="waiting_conflict" if not check.can_merge else "running",
        conflict_files=check.conflict_files,
        error_message="" if check.can_merge else check.message,
        idempotency_key=scoped_key,
        started_at=datetime.now(UTC) if check.can_merge else None,
    )
    session.add(entry)
    await session.flush()
    if check.can_merge:
        repository = await session.get(Repository, workspace.repository_id)
        if repository is None:
            raise ConflictError("Workspace repository no longer exists")
        try:
            result = await WorkspaceManagerClient(requirement_id=requirement_id).merge(
                workspace.path,
                target,
                resolve_repository_credential(repository),
            )
            entry.status = "merged"
            entry.completed_at = datetime.now(UTC)
            workspace.status = "merged"
            workspace.head_commit = str(result.get("head_commit") or workspace.head_commit)
            workspace.version += 1
        except ExternalDependencyError as exc:
            entry.status = "waiting_human"
            entry.error_message = exc.message
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="git.merge_queue",
        resource_type="merge_queue_entry",
        resource_id=entry.id,
        trace_id=trace_id,
        details={"status": entry.status, "workspace_id": workspace.id, "target_branch": target},
    )
    await session.commit()
    await session.refresh(entry)
    return ApiResponse(data=MergeQueueRead.model_validate(entry))


@router.post(
    "/requirements/{requirement_id}/workspace/{workspace_id}/push",
    response_model=ApiResponse[WorkspaceRead],
    dependencies=[developer_access],
)
async def push_workspace(
    requirement_id: int,
    workspace_id: int,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[WorkspaceRead]:
    await get_requirement(session, user, requirement_id)
    workspace = await get_workspace(
        session,
        tenant_id=user.tenant_id,
        requirement_id=requirement_id,
        workspace_id=workspace_id,
    )
    repository = await session.get(Repository, workspace.repository_id)
    if repository is None:
        raise ConflictError("Workspace repository no longer exists")
    result = await WorkspaceManagerClient(requirement_id=requirement_id).push(
        workspace.path,
        resolve_repository_credential(repository),
    )
    workspace.status = "pushed"
    workspace.head_commit = str(result.get("head_commit") or workspace.head_commit)
    workspace.changed_files = list(result.get("changed_files") or [])
    workspace.version += 1
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="git.push",
        resource_type="requirement_workspace",
        resource_id=workspace.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(workspace)
    return ApiResponse(data=WorkspaceRead.model_validate(workspace))
