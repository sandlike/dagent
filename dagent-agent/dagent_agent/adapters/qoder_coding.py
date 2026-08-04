"""QoderCodingAdapter — integrates with Qoder (OpenCode) for code generation.

Responsible for:
  - Sending proposal + codebase context to Qoder
  - Receiving generated code diffs
  - Triggering commit + PR creation via git CLI
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from dagent_agent.config import settings

logger = logging.getLogger(__name__)


class QoderCodingAdapter:
    """Adapter for the Qoder / OpenCode coding agent API."""

    def __init__(self, base_url: str = "", api_key: str = "") -> None:
        self._base_url = base_url or settings.qoder_api_base_url
        self._api_key = api_key or settings.qoder_api_key

    async def generate_code(
        self,
        proposal_document: str,
        repo_local_path: str,
        branch_name: str,
    ) -> dict[str, Any]:
        """Send proposal to Qoder and return generated code diffs.

        Returns dict with keys: ``diffs``, ``files_changed``, ``status``.
        """
        # TODO: implement actual Qoder API call
        logger.info("QoderCodingAdapter.generate_code called for branch=%s", branch_name)
        return {
            "diffs": "",
            "files_changed": [],
            "status": "stub",
        }

    async def commit_and_push(self, repo_local_path: str, branch_name: str, commit_message: str) -> bool:
        """Commit changes and push to remote via git CLI.

        Returns True on success.
        """
        # TODO: subprocess git add + commit + push
        logger.info("commit_and_push stub: %s on %s", commit_message, branch_name)
        return False
