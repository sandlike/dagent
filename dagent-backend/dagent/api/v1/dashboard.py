from fastapi import APIRouter, Query
from sqlalchemy import func, select

from dagent.api.deps import CurrentUser, SessionDep
from dagent.api.schemas.common import ApiResponse
from dagent.api.schemas.domain import RequirementRead
from dagent.models import (
    AgentTask,
    MergeQueueEntry,
    Project,
    ProjectMember,
    Requirement,
    RequirementRepository,
)
from dagent.pipeline.state_machine import WAITING_HUMAN_STATES

router = APIRouter()


def _accessible_requirements(user: CurrentUser):
    query = select(Requirement).where(Requirement.tenant_id == user.tenant_id)
    if "admin" not in user.roles:
        query = query.join(ProjectMember, ProjectMember.project_id == Requirement.project_id).where(
            ProjectMember.user_id == user.id
        )
    return query


async def _serialize_requirements(session: SessionDep, requirements: list[Requirement]) -> list[RequirementRead]:
    if not requirements:
        return []
    rows = await session.execute(
        select(RequirementRepository.requirement_id, RequirementRepository.repository_id).where(
            RequirementRepository.requirement_id.in_([item.id for item in requirements])
        )
    )
    repositories: dict[int, list[int]] = {}
    for requirement_id, repository_id in rows:
        repositories.setdefault(requirement_id, []).append(repository_id)
    return [
        RequirementRead.model_validate(item).model_copy(update={"repository_ids": repositories.get(item.id, [])})
        for item in requirements
    ]


@router.get("/summary", response_model=ApiResponse[dict])
async def summary(user: CurrentUser, session: SessionDep) -> ApiResponse[dict]:
    project_query = select(func.count(Project.id)).where(
        Project.tenant_id == user.tenant_id, Project.status == "active"
    )
    if "admin" not in user.roles:
        project_query = project_query.join(ProjectMember).where(ProjectMember.user_id == user.id)
    requirement_subquery = _accessible_requirements(user).subquery()
    project_count = await session.scalar(project_query) or 0
    requirement_count = await session.scalar(select(func.count()).select_from(requirement_subquery)) or 0
    waiting_count = (
        await session.scalar(
            select(func.count())
            .select_from(requirement_subquery)
            .where(requirement_subquery.c.stage.in_([state.value for state in WAITING_HUMAN_STATES]))
        )
        or 0
    )
    running_tasks = (
        await session.scalar(
            select(func.count(AgentTask.id)).where(
                AgentTask.tenant_id == user.tenant_id,
                AgentTask.status.in_(["queued", "running"]),
            )
        )
        or 0
    )
    waiting_merge_count = (
        await session.scalar(
            select(func.count(MergeQueueEntry.id)).where(
                MergeQueueEntry.tenant_id == user.tenant_id,
                MergeQueueEntry.requirement_id.in_(select(requirement_subquery.c.id)),
                MergeQueueEntry.status.in_(["queued", "running", "waiting_conflict", "waiting_human"]),
            )
        )
        or 0
    )
    return ApiResponse(
        data={
            "project_count": project_count,
            "requirement_count": requirement_count,
            "waiting_human_count": waiting_count,
            "running_task_count": running_tasks,
            "waiting_merge_count": waiting_merge_count,
        }
    )


@router.get("/todos", response_model=ApiResponse[list[RequirementRead]])
async def todos(user: CurrentUser, session: SessionDep) -> ApiResponse[list[RequirementRead]]:
    allowed_stages: set[str] = set()
    if set(user.roles).intersection({"pm", "admin"}):
        allowed_stages.update(["development_document_review", "final_acceptance"])
    if set(user.roles).intersection({"developer", "admin"}):
        allowed_stages.add("development_report_review")
    if not allowed_stages:
        return ApiResponse(data=[])
    requirements = list(
        (await session.scalars(_accessible_requirements(user).where(Requirement.stage.in_(allowed_stages)))).all()
    )
    return ApiResponse(data=await _serialize_requirements(session, requirements))


@router.get("/recent-requirements", response_model=ApiResponse[list[RequirementRead]])
async def recent_requirements(
    user: CurrentUser,
    session: SessionDep,
    limit: int = Query(default=10, ge=1, le=50),
) -> ApiResponse[list[RequirementRead]]:
    requirements = list(
        (
            await session.scalars(_accessible_requirements(user).order_by(Requirement.updated_at.desc()).limit(limit))
        ).all()
    )
    return ApiResponse(data=await _serialize_requirements(session, requirements))
