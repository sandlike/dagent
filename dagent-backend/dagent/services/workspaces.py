from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dagent.api.errors import ExternalDependencyError, NotFoundError
from dagent.config import Settings, get_settings
from dagent.models import (
    AgentTask,
    Repository,
    Requirement,
    RequirementRepository,
    RequirementWorkspace,
)
from dagent.services.credentials import decrypt_git_token


@dataclass(frozen=True)
class RepositoryCredential:
    username: str
    password: str


def resolve_repository_credential(
    source: Repository | str | None,
    settings: Settings | None = None,
) -> RepositoryCredential | None:
    if isinstance(source, Repository):
        if source.credential_ciphertext:
            if not source.credential_username:
                raise ExternalDependencyError("Stored Git credential has no username")
            return RepositoryCredential(
                username=source.credential_username,
                password=decrypt_git_token(source.credential_ciphertext, settings),
            )
        reference = source.credential_ref
    else:
        reference = source
    if not reference:
        return None
    if not reference.startswith("env://"):
        raise ExternalDependencyError("Only env:// Git credential references are supported")
    name = reference.removeprefix("env://").strip()
    raw = os.getenv(name)
    if not raw:
        raise ExternalDependencyError(f"Git credential environment variable {name} is not configured")
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        value = None
    if isinstance(value, dict) and value.get("password"):
        return RepositoryCredential(
            username=str(value.get("username") or "oauth2"),
            password=str(value["password"]),
        )
    if ":" in raw:
        username, password = raw.split(":", 1)
        return RepositoryCredential(username=username or "oauth2", password=password)
    return RepositoryCredential(username="oauth2", password=raw)


class WorkspaceManagerClient:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    async def _post(self, path: str, payload: dict[str, Any], timeout: float = 120.0) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.settings.WORKSPACE_MANAGER_URL.rstrip('/')}{path}",
                    json=payload,
                    headers={"Authorization": f"Bearer {self.settings.AGENT_CALLBACK_TOKEN}"},
                )
            response.raise_for_status()
            result = response.json()
        except httpx.HTTPStatusError as exc:
            try:
                detail = str(exc.response.json().get("error") or exc.response.reason_phrase)
            except (ValueError, AttributeError):
                detail = exc.response.reason_phrase
            raise ExternalDependencyError(f"Workspace manager rejected the operation: {detail[:1000]}") from exc
        except (httpx.HTTPError, ValueError) as exc:
            detail = str(exc) or type(exc).__name__
            raise ExternalDependencyError(f"Workspace manager request failed: {detail}") from exc
        if not isinstance(result, dict):
            raise ExternalDependencyError("Workspace manager returned an invalid response")
        return result

    async def prepare(
        self,
        *,
        tenant_id: int,
        requirement_id: int,
        repositories: list[Repository],
        write_branch: bool,
    ) -> list[dict[str, Any]]:
        items = []
        for repository in repositories:
            credential = resolve_repository_credential(repository, self.settings)
            items.append(
                {
                    "id": repository.id,
                    "name": repository.name,
                    "url": repository.url,
                    "default_branch": repository.default_branch,
                    "credential": (
                        {"username": credential.username, "password": credential.password}
                        if credential
                        else None
                    ),
                }
            )
        result = await self._post(
            "/prepare",
            {
                "tenant_id": tenant_id,
                "requirement_id": requirement_id,
                "branch_name": f"dagent/req-{requirement_id}",
                "write_branch": write_branch,
                "repositories": items,
            },
            timeout=300.0,
        )
        workspaces = result.get("workspaces")
        if not isinstance(workspaces, list):
            raise ExternalDependencyError("Workspace manager did not return workspaces")
        return workspaces

    async def verify(self, repository: Repository, timeout: float = 180.0) -> dict[str, Any]:
        credential = resolve_repository_credential(repository, self.settings)
        return await self._post(
            "/verify",
            {
                "url": repository.url,
                "default_branch": repository.default_branch,
                "credential": (
                    {"username": credential.username, "password": credential.password}
                    if credential
                    else None
                ),
            },
            timeout=timeout,
        )

    async def status(self, path: str) -> dict[str, Any]:
        return await self._post("/status", {"path": path})

    async def enforce_test_scope(self, path: str, expected_head: str) -> dict[str, Any]:
        return await self._post("/enforce-test-scope", {"path": path, "expected_head": expected_head})

    async def commit(self, path: str, message: str, baseline_commit: str) -> dict[str, Any]:
        return await self._post(
            "/commit",
            {"path": path, "message": message, "baseline_commit": baseline_commit},
        )

    async def push(self, path: str, credential: RepositoryCredential | None) -> dict[str, Any]:
        return await self._post(
            "/push",
            {
                "path": path,
                "credential": (
                    {"username": credential.username, "password": credential.password}
                    if credential
                    else None
                ),
            },
        )

    async def merge_check(
        self,
        path: str,
        target_branch: str,
        credential: RepositoryCredential | None = None,
    ) -> dict[str, Any]:
        return await self._post(
            "/merge-check",
            {
                "path": path,
                "target_branch": target_branch,
                "credential": (
                    {"username": credential.username, "password": credential.password}
                    if credential
                    else None
                ),
            },
        )

    async def merge(
        self,
        path: str,
        target_branch: str,
        credential: RepositoryCredential | None,
    ) -> dict[str, Any]:
        return await self._post(
            "/merge",
            {
                "path": path,
                "target_branch": target_branch,
                "credential": (
                    {"username": credential.username, "password": credential.password}
                    if credential
                    else None
                ),
            },
            timeout=300.0,
        )


async def push_requirement_workspaces(
    session: AsyncSession,
    requirement: Requirement,
) -> list[RequirementWorkspace]:
    workspaces = list(
        (
            await session.scalars(
                select(RequirementWorkspace)
                .where(RequirementWorkspace.requirement_id == requirement.id)
                .order_by(RequirementWorkspace.id)
            )
        ).all()
    )
    manager = WorkspaceManagerClient()
    for workspace in workspaces:
        repository = await session.get(Repository, workspace.repository_id)
        if repository is None:
            workspace.status = "push_failed"
            workspace.last_error = "Workspace repository no longer exists"
            workspace.version += 1
            raise ExternalDependencyError(
                f"Workspace {workspace.id} repository no longer exists; delivery can be retried after repair"
            )
        try:
            result = await manager.push(
                workspace.path,
                resolve_repository_credential(repository),
            )
        except ExternalDependencyError as exc:
            workspace.status = "push_failed"
            workspace.last_error = exc.message[:5000]
            workspace.version += 1
            raise ExternalDependencyError(f"Workspace {workspace.id} push failed: {exc.message}") from exc
        workspace.status = "pushed"
        workspace.head_commit = str(result.get("head_commit") or workspace.head_commit)
        workspace.changed_files = list(result.get("changed_files") or workspace.changed_files)
        workspace.last_error = ""
        workspace.version += 1
    return workspaces


async def requirement_repositories(session: AsyncSession, requirement_id: int) -> list[Repository]:
    return list(
        (
            await session.scalars(
                select(Repository)
                .join(RequirementRepository, RequirementRepository.repository_id == Repository.id)
                .where(RequirementRepository.requirement_id == requirement_id)
                .order_by(Repository.id)
            )
        ).all()
    )


async def prepare_task_workspaces(
    session: AsyncSession,
    task: AgentTask,
    requirement: Requirement,
    *,
    client: WorkspaceManagerClient | None = None,
) -> list[RequirementWorkspace]:
    repositories = await requirement_repositories(session, requirement.id)
    write_branch = task.task_type in {"development", "failure_fix"}
    manager = client or WorkspaceManagerClient()
    prepared = await manager.prepare(
        tenant_id=task.tenant_id,
        requirement_id=requirement.id,
        repositories=repositories,
        write_branch=write_branch,
    )
    by_repository_id = {repository.id: repository for repository in repositories}
    workspaces: list[RequirementWorkspace] = []
    for item in prepared:
        repository_id = int(item["repository_id"])
        repository = by_repository_id.get(repository_id)
        if repository is None:
            raise ExternalDependencyError("Workspace manager returned an unexpected repository")
        workspace = await session.scalar(
            select(RequirementWorkspace).where(
                RequirementWorkspace.requirement_id == requirement.id,
                RequirementWorkspace.repository_id == repository_id,
            )
        )
        item_branch = str(item["branch_name"])
        baseline_commit = str(item.get("baseline_commit") or "")
        head_commit = str(item.get("head_commit") or "")
        has_committed_changes = bool(
            baseline_commit
            and head_commit
            and baseline_commit != head_commit
            and item_branch != repository.default_branch
        )
        values = {
            "path": str(item["path"]),
            "base_branch": repository.default_branch,
            "branch_name": item_branch,
            "baseline_commit": baseline_commit,
            "head_commit": head_commit,
            "status": (
                workspace.status
                if workspace is not None and workspace.status in {"committed", "pushed", "merged"}
                else "committed"
                if has_committed_changes
                else "ready"
            ),
            "changed_files": list(item.get("changed_files") or []),
            "last_error": "",
        }
        if workspace is None:
            workspace = RequirementWorkspace(
                tenant_id=task.tenant_id,
                requirement_id=requirement.id,
                repository_id=repository_id,
                **values,
            )
            session.add(workspace)
        else:
            for key, value in values.items():
                setattr(workspace, key, value)
            workspace.version += 1
        workspaces.append(workspace)
    await session.flush()
    return workspaces


async def get_workspace(
    session: AsyncSession,
    *,
    tenant_id: int,
    requirement_id: int,
    workspace_id: int,
) -> RequirementWorkspace:
    workspace = await session.scalar(
        select(RequirementWorkspace).where(
            RequirementWorkspace.id == workspace_id,
            RequirementWorkspace.tenant_id == tenant_id,
            RequirementWorkspace.requirement_id == requirement_id,
        )
    )
    if workspace is None:
        raise NotFoundError("Requirement workspace not found")
    return workspace
