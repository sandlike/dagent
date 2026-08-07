"""Runner — the polling executor loop.

Continuously polls the dagent-backend for queued agent tasks, fetches each task's
context, clones the bound repositories, dispatches to the appropriate agent
(clarification / development-document), and reports the result back.

This is the "postman" that connects the backend's task queue to the opencode-based
agent runtime. It is stateless: all state lives in the backend database, so a crash
or restart simply re-processes any still-queued task.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from dagent_agent.agents.base import AgentContext, CodebaseInfo
from dagent_agent.agents.clarification_agent import ClarificationAgent
from dagent_agent.agents.development_agent import DevelopmentDocumentAgent
from dagent_agent.config import settings
from dagent_agent.executor.backend_client import BackendClient
from dagent_agent.executor.opencode_runner import OpencodeRunner
from dagent_agent.services.codebase_service import CodebaseService

logger = logging.getLogger(__name__)


def _requirement_document_content(artifacts: list[dict]) -> str | None:
    """Return the latest requirement_document artifact content as a Markdown
    string, or None when absent / not a readable string.

    The backend stores the PM-confirmed requirement as a Markdown string (older
    artifacts may be JSON objects, which we skip so the agent falls back to the
    raw description instead of feeding it unreadable JSON)."""
    for art in artifacts:
        if art.get("type") == "requirement_document":
            content = art.get("content")
            if isinstance(content, str) and content.strip():
                return content
    return None


class Runner:
    def __init__(self) -> None:
        self._backend = BackendClient()
        self._codebase = CodebaseService()
        self._opencode = OpencodeRunner()
        self._clarification = ClarificationAgent(opencode=self._opencode)
        self._development = DevelopmentDocumentAgent(opencode=self._opencode)

    async def run_forever(self) -> None:
        logger.info("dagent-agent runner started (poll every %ss)", settings.poll_interval_seconds)
        while True:
            try:
                await self._poll_once()
            except Exception:  # noqa: BLE001
                logger.exception("poll cycle failed")
            await asyncio.sleep(settings.poll_interval_seconds)

    async def run_single(self, requirement_id: int, max_idle_polls: int = 12) -> None:
        """Process only tasks belonging to ``requirement_id``, then exit.

        Single-requirement container mode: a Pod is created for one
        requirement, picks up its currently-queued tasks, processes them, and
        exits once no new tasks for this requirement are seen for
        ``max_idle_polls`` consecutive polls.

        This matches the per-requirement container deployment model where each
        human gate (PM answering clarification, approver reviewing the doc,
        ...) naturally terminates the agent Pod; the next stage spawns a fresh
        Pod rather than holding one alive across the wait.

        Note: the backend's ``/pending`` endpoint does NOT yet filter by
        ``requirement_id`` server-side, so we fetch pending tasks and filter
        client-side on the ``requirement_id`` field of ``AgentTaskRead``. Once
        the backend supports the query param, the filter moves server-side
        automatically (see ``BackendClient.list_pending``).
        """
        logger.info(
            "dagent-agent runner (single-requirement) started for requirement %s "
            "(exit after %d idle polls, poll every %ss)",
            requirement_id, max_idle_polls, settings.poll_interval_seconds,
        )
        idle = 0
        while idle < max_idle_polls:
            try:
                tasks = await self._backend.list_pending(limit=50)
                mine = [t for t in tasks if t.get("requirement_id") == requirement_id]
                if not mine:
                    idle += 1
                    await asyncio.sleep(settings.poll_interval_seconds)
                    continue
                idle = 0  # got work, reset the idle counter
                for task in mine:
                    task_id = task["id"]
                    logger.info(
                        "picked task %s for requirement %s", task_id, requirement_id,
                    )
                    try:
                        await self._process_task(task)
                    except Exception as exc:  # noqa: BLE001
                        logger.exception("task %s failed", task_id)
                        await self._report_failure(task_id, str(exc))
            except Exception:  # noqa: BLE001
                logger.exception("single-requirement poll cycle failed")
                await asyncio.sleep(settings.poll_interval_seconds)
                idle += 1
        logger.info(
            "requirement %s: no new tasks for %d polls, exiting",
            requirement_id, max_idle_polls,
        )

    async def _poll_once(self) -> None:
        tasks = await self._backend.list_pending(limit=10)
        if not tasks:
            return
        for task in tasks:
            task_id = task["id"]
            task_type = task["task_type"]
            logger.info("picked task %s (%s)", task_id, task_type)
            try:
                await self._process_task(task)
            except Exception as exc:  # noqa: BLE001
                logger.exception("task %s failed", task_id)
                await self._report_failure(task_id, str(exc))

    async def _process_task(self, task: dict[str, Any]) -> None:
        task_id = task["id"]
        task_type = task["task_type"]
        context = await self._backend.get_context(task_id)
        requirement = context.get("requirement") or {}
        repos = context.get("repositories") or []

        # Clone the bound repositories; run opencode in the first one's directory.
        work_dir = ""
        if repos:
            codebase_infos = [
                CodebaseInfo(
                    repository_id=r["id"],
                    name=r["name"],
                    git_url=r["url"],
                    default_branch=r.get("default_branch") or "main",
                )
                for r in repos
            ]
            paths = await self._codebase.gather_context(codebase_infos)
            work_dir = paths[0] if paths else ""

        agent_context = AgentContext(
            requirement_id=context.get("task", {}).get("requirement_id", 0),
            project_id=0,
            tenant_id=task.get("tenant_id") if "tenant_id" in task else 0,
            previous_artifacts={
                "clarification_rounds": context.get("clarification_rounds") or [],
                "requirement_document": _requirement_document_content(
                    context.get("artifacts") or []
                ),
            },
            extra={
                "requirement_title": requirement.get("title", ""),
                "requirement_description": requirement.get("description", ""),
                "requirement_priority": requirement.get("priority", "P2"),
                "work_dir": work_dir,
            },
        )

        if task_type == "clarification_generate":
            result = await self._clarification.execute(agent_context)
            await self._report_clarification(task_id, result)
        elif task_type == "development_document_generation":
            result = await self._development.execute(agent_context)
            await self._report_development_document(task_id, result)
        else:
            logger.warning("unsupported task_type %s for task %s", task_type, task_id)
            await self._report_failure(task_id, f"Unsupported task_type: {task_type}")

    async def _report_clarification(self, task_id: int, result: Any) -> None:
        if result.status.value != "success":
            await self._report_failure(task_id, result.error_message or "clarification agent failed")
            return
        questions = result.artifacts.get("clarification_questions") or []
        await self._backend.post_result(
            task_id,
            {
                "status": "succeeded",
                "output_summary": result.output,
                "clarification_questions": questions,
                "logs": [],
            },
        )
        logger.info("task %s: reported %d clarification questions", task_id, len(questions))

    async def _report_development_document(self, task_id: int, result: Any) -> None:
        if result.status.value != "success":
            await self._report_failure(task_id, result.error_message or "development agent failed")
            return
        document = result.artifacts.get("development_document") or ""
        await self._backend.post_result(
            task_id,
            {
                "status": "succeeded",
                "output_summary": result.output,
                "artifact_type": "development_document",
                "artifact_content": document,
                "logs": [],
            },
        )
        logger.info("task %s: reported development document (%d chars)", task_id, len(document))

    async def _report_failure(self, task_id: int, error_message: str) -> None:
        await self._backend.post_result(
            task_id,
            {
                "status": "failed",
                "error_message": error_message[:5000],
                "logs": [error_message[:2000]],
            },
        )
        logger.error("task %s: reported failure: %s", task_id, error_message[:200])
