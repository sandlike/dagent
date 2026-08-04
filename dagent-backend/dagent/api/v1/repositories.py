from datetime import UTC, datetime
from typing import cast

from fastapi import APIRouter, Depends
from sqlalchemy import select

from dagent.api.deps import CurrentUser, SessionDep, TraceId, require_roles
from dagent.api.errors import ConflictError, NotFoundError
from dagent.api.schemas.common import ApiResponse
from dagent.api.schemas.domain import (
    RepositoryCredentialRequest,
    RepositoryRead,
    RepositoryVerificationRead,
    RepositoryVerificationResult,
)
from dagent.models import ProjectMember, ProjectRepository, Repository
from dagent.services.audit import add_audit_log
from dagent.services.credentials import encrypt_git_token
from dagent.services.git import verify_repository

router = APIRouter()
credential_access = Depends(require_roles("pm"))
VERIFICATION_RESULTS = {
    "read_success",
    "read_write_success",
    "token_invalid",
    "no_write_permission",
    "read_failed",
}


def repository_read(repository: Repository) -> RepositoryRead:
    return RepositoryRead.model_validate(repository).model_copy(
        update={"credential_configured": bool(repository.credential_ciphertext or repository.credential_ref)}
    )


async def _repository_for_user(
    repository_id: int,
    user: CurrentUser,
    session: SessionDep,
) -> Repository:
    query = select(Repository).where(
        Repository.id == repository_id,
        Repository.tenant_id == user.tenant_id,
    )
    if "admin" not in user.roles:
        query = (
            query.join(ProjectRepository)
            .join(ProjectMember, ProjectMember.project_id == ProjectRepository.project_id)
            .where(ProjectMember.user_id == user.id)
        )
    repository = await session.scalar(query)
    if repository is None:
        raise NotFoundError("Repository not found")
    return repository


@router.put(
    "/{repository_id}/credential",
    response_model=ApiResponse[RepositoryRead],
    dependencies=[credential_access],
)
async def set_repository_credential(
    repository_id: int,
    payload: RepositoryCredentialRequest,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[RepositoryRead]:
    repository = await _repository_for_user(repository_id, user, session)
    if not repository.url.startswith("https://"):
        raise ConflictError("Database credentials are supported only for HTTPS repositories")
    action = "repository.credential.update" if repository.credential_ciphertext else "repository.credential.set"
    repository.credential_username = payload.username
    repository.credential_ciphertext = encrypt_git_token(payload.token.get_secret_value())
    repository.credential_ref = None
    repository.status = "unverified"
    repository.last_verified_at = None
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action=action,
        resource_type="repository",
        resource_id=repository.id,
        trace_id=trace_id,
        details={"credential_configured": True},
    )
    await session.commit()
    await session.refresh(repository)
    return ApiResponse(data=repository_read(repository))


@router.delete(
    "/{repository_id}/credential",
    response_model=ApiResponse[RepositoryRead],
    dependencies=[credential_access],
)
async def delete_repository_credential(
    repository_id: int,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[RepositoryRead]:
    repository = await _repository_for_user(repository_id, user, session)
    repository.credential_username = None
    repository.credential_ciphertext = None
    repository.credential_ref = None
    repository.status = "unverified"
    repository.last_verified_at = None
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="repository.credential.delete",
        resource_type="repository",
        resource_id=repository.id,
        trace_id=trace_id,
        details={"credential_configured": False},
    )
    await session.commit()
    await session.refresh(repository)
    return ApiResponse(data=repository_read(repository))


@router.post("/{repository_id}/verify", response_model=ApiResponse[RepositoryVerificationRead])
async def verify_repository_endpoint(
    repository_id: int,
    user: CurrentUser,
    session: SessionDep,
    trace_id: TraceId,
) -> ApiResponse[RepositoryVerificationRead]:
    repository = await _repository_for_user(repository_id, user, session)
    result = await verify_repository(repository)
    result_type = str(result.get("result") or "read_failed")
    if result_type not in VERIFICATION_RESULTS:
        result_type = "read_failed"
    typed_result = cast(RepositoryVerificationResult, result_type)
    read_verified = bool(result.get("read_verified"))
    write_verified = bool(result.get("write_verified"))
    credential_configured = bool(repository.credential_ciphertext or repository.credential_ref)
    repository.status = {
        "read_success": "verified",
        "read_write_success": "verified",
        "token_invalid": "credential_invalid",
        "no_write_permission": "read_only",
        "read_failed": "verification_failed",
    }[typed_result]
    repository.last_verified_at = datetime.now(UTC)
    add_audit_log(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="repository.verify",
        resource_type="repository",
        resource_id=repository.id,
        trace_id=trace_id,
        details={
            "result": typed_result,
            "read_verified": read_verified,
            "write_verified": write_verified,
            "credential_configured": credential_configured,
        },
    )
    await session.commit()
    await session.refresh(repository)
    return ApiResponse(
        data=RepositoryVerificationRead(
            repository=repository_read(repository),
            result=typed_result,
            read_verified=read_verified,
            write_verified=write_verified,
            credential_configured=credential_configured,
            message=str(result.get("message") or ""),
        )
    )
