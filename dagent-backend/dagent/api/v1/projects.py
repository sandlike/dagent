from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, func, select

from dagent.api.deps import CurrentUser, SessionDep, TraceId, require_roles
from dagent.api.errors import ConflictError, NotFoundError
from dagent.api.schemas.common import ApiResponse, Page
from dagent.api.schemas.domain import (
    ProjectCreate,
    ProjectRead,
    ProjectUpdate,
    RepositoryBind,
    RepositoryRead,
    ResourceVersionRequest,
)
from dagent.models import (
    Project,
    ProjectMember,
    ProjectRepository,
    Repository,
    Requirement,
    RequirementRepository,
    RequirementWorkspace,
    User,
)
from dagent.services.audit import add_audit_log
from dagent.services.domain import get_project

router = APIRouter()


async def _project_read(session: SessionDep, project: Project) -> ProjectRead:
    repository_count = (
        await session.scalar(select(func.count(ProjectRepository.id)).where(ProjectRepository.project_id == project.id))
        or 0
    )
    requirement_count = (
        await session.scalar(select(func.count(Requirement.id)).where(Requirement.project_id == project.id)) or 0
    )
    return ProjectRead.model_validate(project).model_copy(
        update={"repository_count": repository_count, "requirement_count": requirement_count}
    )


async def _validate_members(session: SessionDep, tenant_id: int, member_ids: set[int]) -> None:
    if not member_ids:
        return
    found = set(
        (await session.scalars(select(User.id).where(User.tenant_id == tenant_id, User.id.in_(member_ids)))).all()
    )
    if found != member_ids:
        raise NotFoundError("One or more project members do not exist in this tenant")


@router.get("", response_model=ApiResponse[Page[ProjectRead]])
async def list_projects(
    user: CurrentUser,
    session: SessionDep,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> ApiResponse[Page[ProjectRead]]:
    query = select(Project).where(Project.tenant_id == user.tenant_id)
    count_query = select(func.count(Project.id)).where(Project.tenant_id == user.tenant_id)
    if "admin" not in user.roles:
        query = query.join(ProjectMember).where(ProjectMember.user_id == user.id)
        count_query = count_query.join(ProjectMember).where(ProjectMember.user_id == user.id)
    total = await session.scalar(count_query) or 0
    projects = list(
        (
            await session.scalars(
                query.order_by(Project.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
            )
        ).all()
    )
    items = [await _project_read(session, project) for project in projects]
    return ApiResponse(data=Page(items=items, total=total, page=page, page_size=page_size))


@router.post("", response_model=ApiResponse[ProjectRead], status_code=201)
async def create_project(
    payload: ProjectCreate,
    session: SessionDep,
    trace_id: TraceId,
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[ProjectRead]:
    member_ids = set(payload.member_ids) | {user.id}
    await _validate_members(session, user.tenant_id, member_ids)
    project = Project(
        tenant_id=user.tenant_id,
        name=payload.name,
        description=payload.description,
        owner_id=user.id,
    )
    session.add(project)
    await session.flush()
    session.add_all(
        [
            ProjectMember(project_id=project.id, user_id=member_id, role="owner" if member_id == user.id else "member")
            for member_id in member_ids
        ]
    )
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="project.create",
        resource_type="project",
        resource_id=project.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(project)
    return ApiResponse(data=await _project_read(session, project))


@router.get("/{project_id}", response_model=ApiResponse[ProjectRead])
async def project_detail(project_id: int, user: CurrentUser, session: SessionDep) -> ApiResponse[ProjectRead]:
    return ApiResponse(data=await _project_read(session, await get_project(session, user, project_id)))


@router.patch("/{project_id}", response_model=ApiResponse[ProjectRead])
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    session: SessionDep,
    trace_id: TraceId,
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[ProjectRead]:
    project = await get_project(session, user, project_id)
    if project.version != payload.resource_version:
        raise ConflictError("Project resource version is stale")
    changes = payload.model_dump(exclude_unset=True, exclude={"member_ids", "resource_version"})
    for field, value in changes.items():
        setattr(project, field, value)
    if payload.member_ids is not None:
        member_ids = set(payload.member_ids) | {project.owner_id}
        await _validate_members(session, user.tenant_id, member_ids)
        await session.execute(delete(ProjectMember).where(ProjectMember.project_id == project.id))
        session.add_all(
            [
                ProjectMember(
                    project_id=project.id, user_id=item, role="owner" if item == project.owner_id else "member"
                )
                for item in member_ids
            ]
        )
    project.version += 1
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="project.update",
        resource_type="project",
        resource_id=project.id,
        trace_id=trace_id,
        details={"fields": sorted(changes)},
    )
    await session.commit()
    await session.refresh(project)
    return ApiResponse(data=await _project_read(session, project))


@router.post("/{project_id}/archive", response_model=ApiResponse[ProjectRead])
async def archive_project(
    project_id: int,
    session: SessionDep,
    trace_id: TraceId,
    payload: ResourceVersionRequest,
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[ProjectRead]:
    project = await get_project(session, user, project_id)
    if project.version != payload.resource_version:
        raise ConflictError("Project resource version is stale")
    project.status = "archived"
    project.version += 1
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="project.archive",
        resource_type="project",
        resource_id=project.id,
        trace_id=trace_id,
    )
    await session.commit()
    await session.refresh(project)
    return ApiResponse(data=await _project_read(session, project))


@router.get("/{project_id}/repositories", response_model=ApiResponse[list[RepositoryRead]])
async def project_repositories(
    project_id: int, user: CurrentUser, session: SessionDep
) -> ApiResponse[list[RepositoryRead]]:
    project = await get_project(session, user, project_id)
    repositories = list(
        (
            await session.scalars(
                select(Repository)
                .join(ProjectRepository)
                .where(ProjectRepository.project_id == project.id, Repository.tenant_id == user.tenant_id)
                .order_by(Repository.created_at.desc())
            )
        ).all()
    )
    return ApiResponse(
        data=[
            RepositoryRead.model_validate(item).model_copy(
                update={"credential_configured": bool(item.credential_ciphertext or item.credential_ref)}
            )
            for item in repositories
        ]
    )


@router.post("/{project_id}/repositories", response_model=ApiResponse[RepositoryRead], status_code=201)
async def bind_repository(
    project_id: int,
    payload: RepositoryBind,
    session: SessionDep,
    trace_id: TraceId,
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[RepositoryRead]:
    project = await get_project(session, user, project_id)
    repository = await session.scalar(
        select(Repository).where(Repository.tenant_id == user.tenant_id, Repository.url == payload.url)
    )
    if repository is None:
        repository = Repository(tenant_id=user.tenant_id, **payload.model_dump())
        session.add(repository)
        await session.flush()
    existing_binding = await session.scalar(
        select(ProjectRepository).where(
            ProjectRepository.project_id == project.id,
            ProjectRepository.repository_id == repository.id,
        )
    )
    if existing_binding is not None:
        raise ConflictError("Repository is already bound to this project")
    session.add(ProjectRepository(project_id=project.id, repository_id=repository.id))
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="repository.bind",
        resource_type="repository",
        resource_id=repository.id,
        trace_id=trace_id,
        details={"project_id": project.id},
    )
    await session.commit()
    await session.refresh(repository)
    return ApiResponse(
        data=RepositoryRead.model_validate(repository).model_copy(
            update={"credential_configured": bool(repository.credential_ciphertext or repository.credential_ref)}
        )
    )


@router.delete("/{project_id}/repositories/{repository_id}", response_model=ApiResponse[dict[str, bool]])
async def delete_project_repository(
    project_id: int,
    repository_id: int,
    session: SessionDep,
    trace_id: TraceId,
    user: User = Depends(require_roles("pm")),
) -> ApiResponse[dict[str, bool]]:
    project = await get_project(session, user, project_id)
    repository = await session.scalar(
        select(Repository)
        .join(ProjectRepository)
        .where(
            Repository.id == repository_id,
            Repository.tenant_id == user.tenant_id,
            ProjectRepository.project_id == project.id,
        )
    )
    if repository is None:
        raise NotFoundError("Repository binding not found")
    requirement_in_use = await session.scalar(
        select(func.count())
        .select_from(RequirementRepository)
        .join(Requirement)
        .where(
            Requirement.project_id == project.id,
            RequirementRepository.repository_id == repository_id,
        )
    )
    workspace_in_use = await session.scalar(
        select(func.count())
        .select_from(RequirementWorkspace)
        .join(Requirement)
        .where(
            Requirement.project_id == project.id,
            RequirementWorkspace.repository_id == repository_id,
        )
    )
    if requirement_in_use or workspace_in_use:
        raise ConflictError("Repository is referenced by requirements or workspaces and cannot be deleted")
    await session.execute(
        delete(ProjectRepository).where(
            ProjectRepository.project_id == project.id,
            ProjectRepository.repository_id == repository_id,
        )
    )
    remaining_project_bindings = (
        await session.scalar(
            select(func.count(ProjectRepository.id)).where(ProjectRepository.repository_id == repository_id)
        )
        or 0
    )
    remaining_requirement_references = (
        await session.scalar(
            select(func.count(RequirementRepository.id)).where(
                RequirementRepository.repository_id == repository_id
            )
        )
        or 0
    )
    remaining_workspaces = (
        await session.scalar(
            select(func.count(RequirementWorkspace.id)).where(
                RequirementWorkspace.repository_id == repository_id
            )
        )
        or 0
    )
    repository_deleted = not (
        remaining_project_bindings or remaining_requirement_references or remaining_workspaces
    )
    if repository_deleted:
        await session.delete(repository)
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="repository.delete",
        resource_type="repository",
        resource_id=repository_id,
        trace_id=trace_id,
        details={
            "project_id": project.id,
            "repository_deleted": repository_deleted,
            "remote_repository_deleted": False,
        },
    )
    await session.commit()
    return ApiResponse(data={"deleted": True, "repository_deleted": repository_deleted})
