"""BackendClient — HTTP client to talk to the dagent-backend internal API.

The agent runtime uses this to discover pending tasks, fetch their full context,
and report results back. All internal endpoints are token-authenticated.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from dagent_agent.config import settings

logger = logging.getLogger(__name__)


class BackendClient:
    def __init__(self, base_url: str = "", token: str = "") -> None:
        self._base = (base_url or settings.backend_api_base_url).rstrip("/")
        self._token = token or settings.agent_callback_token
        self._headers = {"Authorization": f"Bearer {self._token}"}

    async def list_pending(
        self,
        task_type: str | None = None,
        requirement_id: int | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Fetch queued agent tasks.

        ``requirement_id`` is forwarded as a query param so the backend can
        one day filter server-side; today the backend ignores unknown query
        params, so the runner filters client-side (see ``Runner.run_single``).
        """
        params: dict[str, Any] = {"limit": limit}
        if task_type:
            params["task_type"] = task_type
        if requirement_id is not None:
            params["requirement_id"] = requirement_id
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self._base}/api/v1/internal/agent-tasks/pending",
                headers=self._headers,
                params=params,
            )
            resp.raise_for_status()
            body = resp.json()
        return body.get("data") or []

    async def get_context(self, task_id: int) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self._base}/api/v1/internal/agent-tasks/{task_id}/context",
                headers=self._headers,
            )
            resp.raise_for_status()
            body = resp.json()
        return body.get("data") or {}

    async def post_result(self, task_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{self._base}/api/v1/internal/agent-tasks/{task_id}/result",
                headers={**self._headers, "Content-Type": "application/json"},
                json=payload,
            )
            resp.raise_for_status()
            body = resp.json()
        return body.get("data") or {}
