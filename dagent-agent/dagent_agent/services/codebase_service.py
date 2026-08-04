"""CodebaseService — clone, analyse and query code repositories.

All git operations use the git CLI (subprocess), not platform REST APIs.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from dagent_agent.agents.base import CodebaseInfo
from dagent_agent.config import settings

logger = logging.getLogger(__name__)


class CodebaseService:
    """Manage local clones and provide codebase context to agents."""

    def __init__(self, work_dir: str = "") -> None:
        self._work_dir = work_dir or settings.codebase_work_dir

    async def ensure_clone(self, repo: CodebaseInfo) -> str:
        """Clone the repo locally if not already present. Returns local path."""
        local_path = os.path.join(self._work_dir, repo.name)
        if Path(local_path).exists():
            logger.debug("repo %s already cloned at %s", repo.name, local_path)
            return local_path

        # TODO: subprocess git clone
        logger.info("cloning %s -> %s", repo.git_url, local_path)
        return local_path

    async def analyse_structure(self, repo: CodebaseInfo) -> dict[str, Any]:
        """Return a high-level structure summary of the repository."""
        local_path = await self.ensure_clone(repo)
        # TODO: walk directory tree, identify key modules / files
        return {
            "name": repo.name,
            "local_path": local_path,
            "structure_summary": "stub",
        }

    async def gather_context(self, repos: list[CodebaseInfo]) -> str:
        """Collect relevant code snippets and architecture info for LLM prompts."""
        summaries = []
        for repo in repos:
            info = await self.analyse_structure(repo)
            summaries.append(str(info))
        return "\n---\n".join(summaries)

    async def select_affected_repos(self, repos: list[CodebaseInfo], proposal: str) -> list[CodebaseInfo]:
        """Based on the proposal, select repos that will be modified."""
        # TODO: use LLM to decide which repos are affected
        return repos
