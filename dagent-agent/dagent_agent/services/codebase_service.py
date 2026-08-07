"""CodebaseService — clone and update code repositories for agent use.

All git operations use the git CLI via asyncio subprocess. Repositories are cloned
into a persistent working directory so they survive across task invocations.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

from dagent_agent.agents.base import CodebaseInfo
from dagent_agent.config import settings

logger = logging.getLogger(__name__)


class CodebaseService:
    """Manage local clones and provide codebase context to agents."""

    def __init__(self, work_dir: str = "") -> None:
        self._work_dir = work_dir or settings.codebase_work_dir

    def _local_path(self, repo: CodebaseInfo) -> str:
        return os.path.join(self._work_dir, repo.name)

    async def ensure_clone(self, repo: CodebaseInfo) -> str:
        """Clone the repo locally if absent, or fetch updates. Returns local path."""
        local_path = self._local_path(repo)
        Path(self._work_dir).mkdir(parents=True, exist_ok=True)

        if Path(local_path).joinpath(".git").exists():
            logger.info("fetching updates for %s", repo.name)
            await self._git(local_path, "fetch", "--all", "--prune")
            await self._git(local_path, "checkout", repo.default_branch or "main")
            await self._git(local_path, "pull", "--ff-only")
            return local_path

        logger.info("cloning %s -> %s", repo.git_url, local_path)
        await self._git(
            self._work_dir,
            "clone",
            "--depth",
            "50",
            repo.git_url,
            repo.name,
        )
        branch = repo.default_branch or "main"
        await self._git(local_path, "checkout", branch)
        return local_path

    async def _git(self, cwd: str, *args: str) -> str:
        """Run a git command, returning stdout. Raises on non-zero exit."""
        process = await asyncio.create_subprocess_exec(
            "git",
            *args,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            detail = stderr.decode("utf-8", errors="replace").strip()[:500]
            raise RuntimeError(f"git {args[0]} failed (exit {process.returncode}): {detail}")
        return stdout.decode("utf-8", errors="replace")

    async def gather_context(self, repos: list[CodebaseInfo]) -> list[str]:
        """Ensure all repos are cloned; return their local paths."""
        paths: list[str] = []
        for repo in repos:
            path = await self.ensure_clone(repo)
            paths.append(path)
        return paths
