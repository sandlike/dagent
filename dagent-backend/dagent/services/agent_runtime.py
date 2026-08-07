from __future__ import annotations

import asyncio
import json
import re
from contextlib import suppress
from datetime import UTC, datetime
from pathlib import PurePosixPath
from typing import Any

import httpx
from json_repair import repair_json
from pydantic import ValidationError
from sqlalchemy import select, update

from dagent.api.schemas.artifacts import (
    TASK_ARTIFACT_TYPES,
    format_validation_error,
    normalize_artifact_content,
    reconcile_development_report,
    validate_development_report,
)
from dagent.config import Settings
from dagent.db.session import async_session
from dagent.models import (
    AgentSession,
    AgentTask,
    AgentTaskLog,
    Artifact,
    ArtifactVersion,
    ClarificationAnswer,
    ClarificationQuestion,
    ClarificationRound,
    Requirement,
    RequirementWorkspace,
    ReviewRecord,
)
from dagent.services.domain import replace_agent_session
from dagent.services.redaction import redact_sensitive_text
from dagent.services.requirement_runtime import (
    AGENT_ROLE_PORTS,
    AGENT_ROLE_SECRET_SCOPES,
    requirement_runtime_secret_value,
    requirement_runtime_url,
)
from dagent.services.workspaces import WorkspaceManagerClient, prepare_task_workspaces


class ContextWindowExceeded(RuntimeError):
    pass


class OutputFormatJsonSchemaIncompatible(RuntimeError):
    pass


class AgentTaskCancelled(RuntimeError):
    pass


class AgentResponseNotEnglish(RuntimeError):
    pass


class AgentRuntime:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._runner: asyncio.Task[None] | None = None
        self._stopping = asyncio.Event()

    async def start(self) -> None:
        if not self.settings.AGENT_RUNTIME_ENABLED or self._runner is not None:
            return
        self._stopping.clear()
        await self._recover_interrupted_tasks()
        self._runner = asyncio.create_task(self._run(), name="dagent-agent-runtime")

    async def stop(self) -> None:
        self._stopping.set()
        if self._runner is None:
            return
        self._runner.cancel()
        with suppress(asyncio.CancelledError):
            await self._runner
        self._runner = None

    async def abort_task(self, task_id: int) -> None:
        async with async_session() as session:
            task = await session.get(AgentTask, task_id)
            agent_session = await session.get(AgentSession, task.session_id) if task and task.session_id else None
            session_id = str(agent_session.opencode_session_id if agent_session else "")
            role_type = str(agent_session.role_type if agent_session else "")
            directory = str((task.checkpoint if task else {}).get("workspace_root") or "")
        if not session_id:
            return
        if role_type not in {"requirement_clarification", "development_document", "development"}:
            return
        server_url = self._server_url_for_role(role_type, task.requirement_id if task else None)
        with suppress(httpx.HTTPError):
            async with httpx.AsyncClient(
                timeout=10,
                auth=self._auth(task.requirement_id if task else None, role_type),
            ) as client:
                await client.post(
                    f"{server_url}/session/{session_id}/abort",
                    params={"directory": directory} if directory else None,
                )

    def _auth(
        self,
        requirement_id: int | None = None,
        role_type: str | None = None,
    ) -> httpx.BasicAuth:
        if requirement_id is None:
            raise RuntimeError("Requirement id is required for requirement runtime authentication")
        if role_type not in AGENT_ROLE_SECRET_SCOPES:
            raise RuntimeError(f"Unsupported Agent role {role_type}")
        password = requirement_runtime_secret_value(
            self.settings,
            requirement_id,
            AGENT_ROLE_SECRET_SCOPES[role_type],
        )
        return httpx.BasicAuth(
            self.settings.OPENCODE_SERVER_USERNAME,
            password,
        )

    def _server_url_for_role(self, role_type: str, requirement_id: int | None = None) -> str:
        if role_type not in {
            "requirement_clarification",
            "development_document",
            "development",
        }:
            raise RuntimeError(f"Unsupported Agent role {role_type}")
        if requirement_id is None:
            raise RuntimeError("Requirement id is required for a requirement Agent runtime")
        return requirement_runtime_url(
            self.settings,
            requirement_id,
            AGENT_ROLE_PORTS[role_type],
        )

    @staticmethod
    def _role_for_context(context: dict[str, Any]) -> str:
        snapshot = context.get("checkpoint", {}).get("agent_snapshot", {})
        role_type = str(snapshot.get("role_type") or "")
        if not role_type:
            task_type = context.get("task_type")
            if task_type == "clarification_generate":
                role_type = "requirement_clarification"
            elif task_type == "development_document_generation":
                role_type = "development_document"
            else:
                role_type = "development"
        return role_type

    def _server_url_for_context(self, context: dict[str, Any]) -> str:
        return self._server_url_for_role(
            self._role_for_context(context), int(context["requirement_id"])
        )

    def _workspace_manager(self, requirement_id: int | None = None) -> WorkspaceManagerClient:
        if self.settings.REQUIREMENT_RUNTIME_ENABLED and requirement_id is not None:
            return WorkspaceManagerClient(self.settings, requirement_id=requirement_id)
        return WorkspaceManagerClient(self.settings)

    async def _recover_interrupted_tasks(self) -> None:
        async with async_session() as session:
            await session.execute(
                update(AgentTask)
                .where(AgentTask.status == "running")
                .values(status="queued", error_message="Recovered after backend restart")
            )
            await session.commit()

    async def _run(self) -> None:
        workers = [asyncio.create_task(self._run_worker()) for _ in range(max(1, self.settings.AGENT_RUNTIME_WORKERS))]
        try:
            await asyncio.gather(*workers)
        finally:
            for worker in workers:
                if not worker.done():
                    worker.cancel()

    async def _run_worker(self) -> None:
        while not self._stopping.is_set():
            try:
                task_id = await self._claim_next_task()
                if task_id is None:
                    await asyncio.wait_for(
                        self._stopping.wait(),
                        timeout=self.settings.AGENT_POLL_INTERVAL_SECONDS,
                    )
                    continue
                await self._execute(task_id)
            except TimeoutError:
                continue
            except asyncio.CancelledError:
                raise
            except Exception:
                await asyncio.sleep(self.settings.AGENT_POLL_INTERVAL_SECONDS)

    async def _claim_next_task(self) -> int | None:
        async with async_session() as session:
            task_id = await session.scalar(
                select(AgentTask.id).where(AgentTask.status == "queued").order_by(AgentTask.id).limit(1)
            )
            if task_id is None:
                return None
            result = await session.execute(
                update(AgentTask)
                .where(AgentTask.id == task_id, AgentTask.status == "queued")
                .values(status="running", started_at=datetime.now(UTC), error_message="")
            )
            if getattr(result, "rowcount", 0) != 1:
                await session.rollback()
                return None
            task = await session.get(AgentTask, task_id)
            if task is None:
                await session.rollback()
                return None
            session.add(
                AgentTaskLog(
                    tenant_id=task.tenant_id,
                    task_id=task_id,
                    level="info",
                    message="Task claimed by Agent runtime",
                )
            )
            await session.commit()
            return int(task_id)

    async def _log(self, task_id: int, level: str, message: str) -> None:
        async with async_session() as session:
            task = await session.get(AgentTask, task_id)
            if task is None:
                return
            session.add(AgentTaskLog(tenant_id=task.tenant_id, task_id=task.id, level=level, message=message[:20_000]))
            await session.commit()

    async def _wait_for_requirement_runtime(self, task_id: int) -> None:
        if not self.settings.REQUIREMENT_RUNTIME_ENABLED:
            return
        async with async_session() as session:
            task = await session.get(AgentTask, task_id)
            agent_session = (
                await session.get(AgentSession, task.session_id)
                if task and task.session_id
                else None
            )
        if task is None or agent_session is None:
            raise RuntimeError("Agent task no longer exists")
        requirement_id = int(task.requirement_id)
        role_type = str(agent_session.role_type)
        opencode_url = self._server_url_for_role(role_type, requirement_id)
        workspace_url = requirement_runtime_url(self.settings, requirement_id, 8090)
        deadline = asyncio.get_running_loop().time() + min(
            300, self.settings.AGENT_TASK_TIMEOUT_SECONDS
        )
        last_error = "runtime is not ready"
        async with httpx.AsyncClient(
            timeout=5,
            auth=self._auth(requirement_id, role_type),
        ) as opencode_client:
            async with httpx.AsyncClient(timeout=5) as workspace_client:
                while asyncio.get_running_loop().time() < deadline:
                    await self._raise_if_task_cancelled(task_id)
                    try:
                        opencode_response, workspace_response = await asyncio.gather(
                            opencode_client.get(opencode_url),
                            workspace_client.get(f"{workspace_url}/health"),
                        )
                        if (
                            opencode_response.status_code == 200
                            and workspace_response.status_code == 200
                        ):
                            await self._log(
                                task_id,
                                "info",
                                f"Requirement Agent Pod is ready for requirement {requirement_id}",
                            )
                            return
                        last_error = (
                            f"OpenCode HTTP {opencode_response.status_code}; "
                            f"workspace HTTP {workspace_response.status_code}"
                        )
                    except httpx.HTTPError as exc:
                        last_error = str(exc)
                    await asyncio.sleep(2)
        raise RuntimeError(
            f"Requirement Agent Pod {requirement_id} did not become ready: {last_error}"
        )

    async def _execute(self, task_id: int) -> None:
        try:
            await self._wait_for_requirement_runtime(task_id)
            await self._log(task_id, "info", "Preparing requirement workspace")
            context = await self._prepare_context(task_id)
            await self._log(task_id, "info", f"OpenCode session directory: {context['workspace_root']}")
            session_id = await self._ensure_session(task_id, context)
            await self._log(task_id, "info", f"OpenCode main session {session_id} selected")
            try:
                response, tool_evidence = await self._send_prompt(session_id, context)
            except ContextWindowExceeded:
                session_id = await self._replace_session(task_id, context, "context_exceeded")
                await self._log(task_id, "warning", f"Context limit reached; replaced session with {session_id}")
                response, tool_evidence = await self._send_prompt(session_id, context)
            except OutputFormatJsonSchemaIncompatible:
                session_id = await self._replace_session(task_id, context, "output_format_incompatible")
                await self._log(
                    task_id,
                    "warning",
                    f"OpenCode session contained incompatible output format; replaced session with {session_id}",
                )
                response, tool_evidence = await self._send_prompt(session_id, context)
            task_type = str(context["task_type"])
            try:
                result = self._parse_result(task_type, response)
                self._validate_result_contract(task_type, result)
            except RuntimeError as exc:
                if not isinstance(exc, AgentResponseNotEnglish) and task_type not in {
                    "development",
                    "failure_fix",
                    "test_plan_generation",
                }:
                    raise
                await self._log(
                    task_id,
                    "warning",
                    f"Agent result validation failed; requesting one correction: {exc}",
                )
                corrected_response, correction_evidence = await self._send_prompt(
                    session_id,
                    context,
                    correction_error=str(exc),
                )
                tool_evidence.extend(correction_evidence)
                result = self._parse_result(task_type, corrected_response)
                self._validate_result_contract(task_type, result)
            if context["task_mode"] in {"requirement_clarification", "development_document", "test_plan"}:
                await self._verify_read_only_workspaces(context)
            if context["task_mode"] in {"implementation", "failure_fix"}:
                result = await self._commit_changes(task_id, context, result)
            for evidence in tool_evidence:
                await self._log(
                    task_id,
                    "info",
                    f"bash exit={evidence['exit_code']}: {evidence['command']}\n{evidence['evidence']}",
                )
            await self._report_result(
                task_id,
                {
                    "status": "succeeded",
                    "checkpoint": {"tool_evidence": tool_evidence} if tool_evidence else {},
                    **result,
                },
            )
            await self._log(task_id, "info", "Agent result accepted by Dagent")
        except AgentTaskCancelled:
            await self._log(task_id, "info", "Agent execution stopped after task cancellation")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            message = str(exc)[:20_000]
            await self._log(task_id, "error", message)
            with suppress(Exception):
                await self._report_result(
                    task_id,
                    {
                        "status": "failed",
                        "error_message": message,
                        "output_summary": "Task execution failed",
                        "logs": [],
                    },
                )

    async def _prepare_context(self, task_id: int) -> dict[str, Any]:
        async with async_session() as session:
            task = await session.get(AgentTask, task_id)
            if task is None:
                raise RuntimeError("Agent task no longer exists")
            requirement = await session.get(Requirement, task.requirement_id)
            if requirement is None:
                raise RuntimeError("Task requirement no longer exists")
            workspaces = await prepare_task_workspaces(
                session,
                task,
                requirement,
                client=self._workspace_manager(requirement.id),
            )
            workspace_root = str(
                PurePosixPath(workspaces[0].path).parent
                if workspaces
                else PurePosixPath(self.settings.AGENT_WORKSPACE_ROOT)
                / f"tenant-{task.tenant_id}"
                / f"requirement-{requirement.id}"
            )
            artifact_rows = list(
                (
                    await session.execute(
                        select(Artifact.artifact_type, ArtifactVersion.content)
                        .join(ArtifactVersion, ArtifactVersion.artifact_id == Artifact.id)
                        .where(
                            Artifact.requirement_id == requirement.id,
                            ArtifactVersion.version == Artifact.current_version,
                        )
                    )
                ).all()
            )
            reviews = list(
                (
                    await session.scalars(
                        select(ReviewRecord)
                        .where(ReviewRecord.requirement_id == requirement.id)
                        .order_by(ReviewRecord.id.desc())
                        .limit(20)
                    )
                ).all()
            )
            clarification_rows = list(
                (
                    await session.execute(
                        select(ClarificationRound, ClarificationQuestion, ClarificationAnswer)
                        .outerjoin(
                            ClarificationQuestion,
                            ClarificationQuestion.round_id == ClarificationRound.id,
                        )
                        .outerjoin(
                            ClarificationAnswer,
                            ClarificationAnswer.question_id == ClarificationQuestion.id,
                        )
                        .where(ClarificationRound.requirement_id == requirement.id)
                        .order_by(
                            ClarificationRound.round_no,
                            ClarificationQuestion.id,
                            ClarificationAnswer.id,
                        )
                    )
                ).all()
            )
            clarification_rounds: list[dict[str, Any]] = []
            rounds_by_id: dict[int, dict[str, Any]] = {}
            questions_by_id: dict[int, dict[str, Any]] = {}
            for round_item, question, answer in clarification_rows:
                round_payload = rounds_by_id.get(round_item.id)
                if round_payload is None:
                    round_payload = {
                        "round_no": round_item.round_no,
                        "status": round_item.status,
                        "questions": [],
                    }
                    rounds_by_id[round_item.id] = round_payload
                    clarification_rounds.append(round_payload)
                if question is None:
                    continue
                question_payload = questions_by_id.get(question.id)
                if question_payload is None:
                    question_payload = {
                        "question": question.question,
                        "question_type": question.question_type,
                        "options": list(question.options),
                        "ai_recommendation": question.ai_recommendation,
                        "answers": [],
                    }
                    questions_by_id[question.id] = question_payload
                    round_payload["questions"].append(question_payload)
                if answer is not None:
                    question_payload["answers"].append(
                        {
                            "answer": self._resolve_answer_text(answer.answer, question.options),
                            "answer_value": answer.answer,
                            "created_at": answer.created_at.isoformat(),
                        }
                    )
            checkpoint = dict(task.checkpoint)
            checkpoint["workspace_root"] = workspace_root
            checkpoint["workspace_ids"] = [item.id for item in workspaces]
            artifacts = {str(kind): content for kind, content in artifact_rows}
            task.checkpoint = checkpoint
            await session.commit()
            return {
                "task_id": task.id,
                "task_type": task.task_type,
                "task_mode": str(checkpoint.get("task_mode") or ""),
                "session_id": task.session_id,
                "tenant_id": task.tenant_id,
                "requirement_id": requirement.id,
                "title": requirement.title,
                "description": requirement.description,
                "input_summary": task.input_summary,
                "workspace_root": workspace_root,
                "workspaces": [
                    {
                        "id": item.id,
                        "repository_id": item.repository_id,
                        "path": item.path,
                        "branch": item.branch_name,
                        "base_branch": item.base_branch,
                        "baseline_commit": item.baseline_commit,
                        "head_commit": item.head_commit,
                        "changed_files": list(item.changed_files),
                    }
                    for item in workspaces
                ],
                "artifacts": artifacts,
                "clarification_rounds": clarification_rounds,
                "review_feedback": [
                    {
                        "gate": item.gate,
                        "action": item.action,
                        "artifact_version": item.artifact_version,
                        "reviewer_id": item.reviewer_id,
                        "comment": item.comment,
                        "created_at": item.created_at.isoformat(),
                    }
                    for item in reversed(reviews)
                ],
                "checkpoint": checkpoint,
            }

    @staticmethod
    def _resolve_answer_text(answer: Any, options: list[dict[str, Any]]) -> Any:
        option_labels = {
            str(option.get("id")): (
                f"{option.get('label')} ({option.get('description')})"
                if option.get("description")
                else str(option.get("label") or option.get("id") or "")
            )
            for option in options
            if option.get("id") is not None
        }

        def resolve(value: Any) -> Any:
            return option_labels.get(str(value), value)

        if isinstance(answer, list):
            return [resolve(value) for value in answer]
        return resolve(answer)

    async def _ensure_session(self, task_id: int, context: dict[str, Any]) -> str:
        async with async_session() as session:
            task = await session.get(AgentTask, task_id)
            agent_session = await session.get(AgentSession, task.session_id) if task and task.session_id else None
            if task is None or agent_session is None:
                raise RuntimeError("Agent task is not linked to a main session")
            previous = str(agent_session.opencode_session_id or "")
            server_url = self._server_url_for_role(
                agent_session.role_type, context["requirement_id"]
            )
        params = {"directory": context["workspace_root"]}
        async with httpx.AsyncClient(
            timeout=30,
            auth=self._auth(int(context["requirement_id"]), str(agent_session.role_type)),
        ) as client:
            if previous:
                response = await client.get(
                    f"{server_url}/session/{previous}",
                    params=params,
                )
                await self._inspect_opencode_response(task_id, response)
                if response.status_code == 200:
                    return previous
                if response.status_code != 404:
                    response.raise_for_status()
                return await self._replace_session(task_id, context, "damaged")
            response = await client.post(
                f"{server_url}/session",
                params=params,
                json={"title": f"REQ-{context['requirement_id']} {agent_session.role_type}"},
            )
            await self._inspect_opencode_response(task_id, response)
            response.raise_for_status()
            session_id = str(response.json()["id"])
        async with async_session() as session:
            task = await session.get(AgentTask, task_id)
            agent_session = await session.get(AgentSession, task.session_id) if task and task.session_id else None
            if agent_session is not None:
                agent_session.opencode_session_id = session_id
                await session.commit()
        return session_id

    async def _replace_session(self, task_id: int, context: dict[str, Any], reason: str) -> str:
        async with async_session() as session:
            task = await session.get(AgentTask, task_id)
            if task is None:
                raise RuntimeError("Agent task no longer exists")
            replacement = await replace_agent_session(session, task, reason=reason)
            await session.commit()
            server_url = self._server_url_for_role(
                replacement.role_type, context["requirement_id"]
            )
        params = {"directory": context["workspace_root"]}
        async with httpx.AsyncClient(
            timeout=30,
            auth=self._auth(int(context["requirement_id"]), str(replacement.role_type)),
        ) as client:
            response = await client.post(
                f"{server_url}/session",
                params=params,
                json={"title": f"REQ-{context['requirement_id']} replacement"},
            )
            await self._inspect_opencode_response(task_id, response)
            response.raise_for_status()
            opencode_session_id = str(response.json()["id"])
        async with async_session() as session:
            replacement_record = await session.get(AgentSession, replacement.id)
            if replacement_record is None:
                raise RuntimeError("Replacement Agent session no longer exists")
            replacement_record.opencode_session_id = opencode_session_id
            await session.commit()
        context["session_id"] = replacement_record.id
        return opencode_session_id

    async def _send_prompt(
        self,
        session_id: str,
        context: dict[str, Any],
        correction_error: str | None = None,
    ) -> tuple[str, list[dict[str, Any]]]:
        agent = self._role_for_context(context)
        server_url = self._server_url_for_context(context)
        tools = self._tools_for_mode(context["task_mode"])
        if correction_error and context["task_type"] in {"development", "failure_fix"}:
            tools = self._tools_for_mode("development_document")
        prompt = self._build_prompt(context, correction_error=correction_error)
        async with httpx.AsyncClient(
            timeout=self.settings.AGENT_TASK_TIMEOUT_SECONDS,
            auth=self._auth(int(context["requirement_id"]), agent),
        ) as client:
            message_url = f"{server_url}/session/{session_id}/message"
            history_response = await client.get(message_url, params={"directory": context["workspace_root"]})
            await self._inspect_opencode_response(context["task_id"], history_response)
            history_response.raise_for_status()
            existing_messages = history_response.json()
            existing_ids = {
                str(message.get("info", {}).get("id"))
                for message in existing_messages
                if isinstance(message, dict) and isinstance(message.get("info"), dict)
            }
            response = await client.post(
                message_url,
                params={"directory": context["workspace_root"]},
                json={
                    "agent": agent,
                    "tools": tools,
                    "parts": [{"type": "text", "text": prompt}],
                },
            )
            await self._inspect_opencode_response(context["task_id"], response)
            if response.status_code in {400, 413} and any(
                marker in response.text.lower()
                for marker in ("context length", "context window", "maximum context", "token limit")
            ):
                raise ContextWindowExceeded("OpenCode context window exceeded")
            response.raise_for_status()
            payload = await self._wait_for_message_completion(
                client,
                message_url,
                context["workspace_root"],
                context["task_id"],
                existing_ids,
                response.json(),
            )
        return self._response_content(payload), self._tool_evidence(payload)

    async def _wait_for_message_completion(
        self,
        client: httpx.AsyncClient,
        message_url: str,
        directory: str,
        task_id: int,
        existing_ids: set[str],
        initial_payload: Any,
    ) -> dict[str, Any]:
        deadline = asyncio.get_running_loop().time() + self.settings.AGENT_TASK_TIMEOUT_SECONDS
        logged_progress: set[str] = set()
        while True:
            await self._raise_if_task_cancelled(task_id)
            history_response = await client.get(message_url, params={"directory": directory})
            await self._inspect_opencode_response(task_id, history_response)
            history_response.raise_for_status()
            history = history_response.json()
            await self._log_history_progress(task_id, history, existing_ids, logged_progress)
            aggregated, complete = self._aggregate_new_assistant_messages(
                history,
                existing_ids,
                initial_payload,
            )
            if complete and aggregated is not None:
                return aggregated
            if asyncio.get_running_loop().time() >= deadline:
                raise TimeoutError("OpenCode did not finish the Agent message before the task timeout")
            await asyncio.sleep(0.5)

    async def _log_history_progress(
        self,
        task_id: int,
        messages: Any,
        existing_ids: set[str],
        logged_progress: set[str],
    ) -> None:
        if not isinstance(messages, list):
            return
        for message in messages:
            if not isinstance(message, dict):
                continue
            info = message.get("info")
            if not isinstance(info, dict) or info.get("role") != "assistant":
                continue
            message_id = str(info.get("id") or "")
            if not message_id or message_id in existing_ids:
                continue

            finish = str(info.get("finish") or "unknown")
            status_key = f"{message_id}:status:{finish}"
            if status_key not in logged_progress:
                await self._log(task_id, "info", f"Agent message {message_id} status: {finish}")
                logged_progress.add(status_key)

            parts = message.get("parts")
            if not isinstance(parts, list):
                continue
            for index, part in enumerate(parts):
                if not isinstance(part, dict):
                    continue
                part_type = str(part.get("type") or "")
                if part_type == "text" and part.get("text"):
                    key = f"{message_id}:text:{index}:{part['text']}"
                    if key not in logged_progress:
                        await self._log(task_id, "info", self._redact_tool_text(str(part["text"])))
                        logged_progress.add(key)
                    continue
                if part_type != "tool":
                    continue
                raw_state = part.get("state")
                state: dict[str, Any] = raw_state if isinstance(raw_state, dict) else {}
                raw_input = state.get("input")
                tool_input: dict[str, Any] = raw_input if isinstance(raw_input, dict) else {}
                command = str(tool_input.get("command") or part.get("command") or "").strip()
                tool_name = str(part.get("tool") or "tool")
                detail = command or json.dumps(tool_input, ensure_ascii=False)
                key = f"{message_id}:tool:{index}:{state.get('status')}:{detail}"
                if key not in logged_progress:
                    message_text = f"Agent tool {tool_name}: {detail}" if detail else f"Agent tool {tool_name}"
                    await self._log(task_id, "info", self._redact_tool_text(message_text))
                    logged_progress.add(key)

    @staticmethod
    async def _raise_if_task_cancelled(task_id: int) -> None:
        async with async_session() as session:
            status = await session.scalar(select(AgentTask.status).where(AgentTask.id == task_id))
        if status == "cancelled":
            raise AgentTaskCancelled(f"Agent task {task_id} was cancelled")

    @staticmethod
    def _raise_if_output_format_incompatible(response: httpx.Response) -> None:
        if response.status_code == 400 and "outputformatjsonschema" in response.text.lower():
            raise OutputFormatJsonSchemaIncompatible(
                "OpenCode cannot read a session containing OutputFormatJsonSchema"
            )

    async def _inspect_opencode_response(self, task_id: int, response: httpx.Response) -> None:
        if response.status_code == 400:
            body = self._redact_tool_text(response.text[:20_000])
            await self._log(task_id, "error", f"OpenCode HTTP 400: {body}")
        self._raise_if_output_format_incompatible(response)

    @staticmethod
    def _aggregate_new_assistant_messages(
        messages: Any,
        existing_ids: set[str],
        initial_payload: Any,
    ) -> tuple[dict[str, Any] | None, bool]:
        candidates = list(messages) if isinstance(messages, list) else []
        if isinstance(initial_payload, dict):
            initial_info = initial_payload.get("info")
            initial_id = str(initial_info.get("id")) if isinstance(initial_info, dict) else ""
            if initial_id and all(
                not isinstance(message, dict)
                or not isinstance(message.get("info"), dict)
                or str(message["info"].get("id")) != initial_id
                for message in candidates
            ):
                candidates.append(initial_payload)

        assistant_messages = []
        for message in candidates:
            if not isinstance(message, dict):
                continue
            info = message.get("info")
            if not isinstance(info, dict):
                continue
            message_id = str(info.get("id") or "")
            if not message_id or message_id in existing_ids or info.get("role") != "assistant":
                continue
            assistant_messages.append(message)
        if not assistant_messages:
            return None, False

        final_message = assistant_messages[-1]
        raw_final_info = final_message.get("info")
        final_info: dict[str, Any] = raw_final_info if isinstance(raw_final_info, dict) else {}
        complete = bool(final_info.get("error")) or final_info.get("finish") == "stop"
        parts: list[dict[str, Any]] = []
        for message in assistant_messages:
            raw_parts = message.get("parts")
            if isinstance(raw_parts, list):
                parts.extend(part for part in raw_parts if isinstance(part, dict))
        return {"info": final_info, "parts": parts}, complete

    @staticmethod
    def _tools_for_mode(task_mode: str) -> dict[str, bool]:
        tools = {"task": False}
        if task_mode in {"requirement_clarification", "development_document", "test_plan"}:
            tools.update(
                {
                    "edit": False,
                    "write": False,
                    "apply_patch": False,
                    "bash": False,
                }
            )
        return tools

    def _tool_evidence(self, payload: Any) -> list[dict[str, Any]]:
        if not isinstance(payload, dict):
            return []
        evidence: list[dict[str, Any]] = []
        for part in payload.get("parts", []):
            if not isinstance(part, dict) or part.get("type") != "tool" or part.get("tool") != "bash":
                continue
            raw_state = part.get("state")
            state: dict[str, Any] = raw_state if isinstance(raw_state, dict) else {}
            raw_input = state.get("input")
            tool_input: dict[str, Any] = raw_input if isinstance(raw_input, dict) else {}
            raw_metadata = state.get("metadata")
            metadata: dict[str, Any] = raw_metadata if isinstance(raw_metadata, dict) else {}
            if state.get("status") != "completed":
                continue
            command = str(tool_input.get("command") or part.get("command") or "").strip()
            if not command:
                continue
            raw_exit_code = next(
                (
                    value
                    for value in (
                        metadata.get("exit"),
                        metadata.get("exit_code"),
                        state.get("exit_code"),
                        state.get("code"),
                    )
                    if isinstance(value, int)
                ),
                None,
            )
            state_status = str(state.get("status") or "")
            exit_code = raw_exit_code if raw_exit_code is not None else (0 if state_status == "completed" else 1)
            output = str(
                state.get("output")
                or metadata.get("output")
                or state.get("error")
                or "命令未输出日志"
            )
            evidence.append(
                {
                    "command": self._redact_tool_text(command),
                    "exit_code": exit_code,
                    "evidence": self._redact_tool_text(output)[-4_000:],
                }
            )
        return evidence

    def _redact_tool_text(self, value: str) -> str:
        return redact_sensitive_text(
            value,
            (
                self.settings.AGENT_CALLBACK_TOKEN,
                self.settings.LLM_API_KEY,
            ),
        )

    def _response_content(self, payload: Any) -> str:
        if not isinstance(payload, dict):
            raise RuntimeError("OpenCode returned an invalid response")
        info = payload.get("info")
        if isinstance(info, dict):
            structured_output = info.get("structured_output", info.get("structured"))
            if structured_output is not None:
                return json.dumps(structured_output, ensure_ascii=False)
            error = info.get("error")
            if isinstance(error, dict):
                data = error.get("data")
                message = data.get("message") if isinstance(data, dict) else error.get("message")
                raise RuntimeError(f"OpenCode failed: {message or error.get('name') or 'unknown error'}")
        parts = payload.get("parts", []) if isinstance(payload, dict) else []
        texts = [str(part.get("text")) for part in parts if part.get("type") == "text" and part.get("text")]
        if not texts:
            return json.dumps(payload, ensure_ascii=False)
        return "\n".join(texts)

    def _build_prompt(self, context: dict[str, Any], *, correction_error: str | None = None) -> str:
        retry_context = context["checkpoint"].get("retry_context")
        common = (
            f"[DAGENT_CONTEXT task_id={context['task_id']} requirement_id={context['requirement_id']}]\n"
            f"Requirement title: {context['title']}\n"
            f"Requirement description:\n{context['description']}\n\n"
            f"Task summary: {context['input_summary']}\n"
            f"Task mode: {context.get('task_mode', context['task_type'])}\n"
            f"Workspace root: {context['workspace_root']}\n"
            f"Repositories: {json.dumps(context['workspaces'], ensure_ascii=False)}\n"
            f"Current approved artifacts: {json.dumps(context['artifacts'], ensure_ascii=False)}\n\n"
            "Clarification rounds and PM answers, oldest to newest; later answers override earlier answers: "
            f"{json.dumps(context.get('clarification_rounds', []), ensure_ascii=False)}\n\n"
            f"Review decisions and feedback: {json.dumps(context.get('review_feedback', []), ensure_ascii=False)}\n"
            "Any unresolved rejection feedback must be addressed explicitly in the next result.\n\n"
            "Fixed Agent snapshot: "
            f"{json.dumps(context['checkpoint'].get('agent_snapshot', {}), ensure_ascii=False)}\n\n"
            "The fixed Agent snapshot is the configuration selected when this requirement was created. "
            "Use only its role, prompt reference, Skill policy, MCP policy, and tool policy. Do not load a Skill "
            "that is not listed in skill_policy and do not enable an MCP or tool forbidden by that snapshot.\n\n"
            "Return English only. Every human-readable string in the final JSON must be written in English, even "
            "when the requirement, user input, repository content, artifacts, or review feedback are Chinese. "
            "Do not output Chinese characters in the final response.\n\n"
        )
        if isinstance(retry_context, dict):
            previous_task_id = retry_context.get("previous_task_id")
            previous_error = self._redact_tool_text(str(retry_context.get("previous_error") or "")).strip()
            common += (
                f"This is a retry of task #{previous_task_id}.\n"
                f"Previous final backend error: {previous_error or 'The previous task did not complete.'}\n"
                "Continue from the existing Session and workspace state. Do not repeat work that is already "
                "complete; directly correct the previous failure.\n\n"
            )
        if correction_error:
            common += (
                "Your previous response was rejected by backend validation. Correct the complete response once and "
                f"address these exact errors: {correction_error}\n\n"
            )
        task_type = context["task_type"]
        if task_type == "clarification_generate":
            return common + (
                "Load and follow the grill-me skill. Act as a requirement clarification agent and analyze the "
                "requirement and repository read-only. Use Serena semantic tools to inspect symbols and references "
                "when useful. "
                "First inspect the codebase and resolve facts yourself; do not ask the user about decisions that can "
                "be answered from existing code, models, APIs, dependencies, or conventions. Walk the decision tree, "
                "ask one focused unresolved decision per question, and identify dependencies between decisions. "
                "Use the existing clarification rounds and answers in Current approved artifacts to avoid repeating "
                "questions; ask only the next unresolved decisions. Every question must include a concrete AI "
                "recommendation grounded in a file or code pattern and a brief reason. Do not edit files. "
                "Write every question, option, recommendation, and summary in English. Return only JSON with keys "
                '"output_summary" and "clarification_questions". Each question must contain question, '
                'question_type (single|multiple|text|file), required, options, and ai_recommendation. '
                "Generate 3 to 6 focused questions when unresolved decisions remain; use an empty list only when "
                "the requirement is fully specified. Single/multiple questions must have 2 to 4 options with unique "
                "ids, labels, and descriptions; text questions must have an empty options list. "
                "Escape any ASCII double quotes inside JSON string values."
            )
        if task_type == "development_document_generation":
            return common + (
                "Load and follow the dev-plan skill. Read the repositories without modifying them and use Serena "
                "semantic tools when useful. Treat confirmed PM answers as authoritative: later clarification rounds "
                "override earlier rounds, and confirmed answers override conflicting original requirement text. "
                "Open every real file before citing it. impacted_modules.path must contain only verified relative file "
                "paths you actually opened; never invent a path, module, table, endpoint, command, or dependency. "
                "Identify affected components first, then write ordered, concrete implementation steps. Keep data "
                "model changes, API/interface changes, implementation, rollback, and tests distinct. "
                "Produce an actionable development document without changing code. "
                'Return only JSON with "output_summary" and "artifact_content". Write human-readable values in '
                "English. The artifact must cover goals, non-goals, impacted modules, frontend/backend/"
                "Agent/data changes, APIs, implementation steps, risks, rollback, tests, and acceptance checklist."
            )
        if task_type in {"development", "failure_fix"}:
            if correction_error:
                return common + (
                    "The implementation and checks are already complete. Do not modify files or rerun commands. "
                    "Correct only the complete development report JSON using the work and command results already "
                    f"present in this session. Backend validation errors: {correction_error}\n"
                    'Return only JSON with "output_summary" and "artifact_content". The checks array must contain '
                    'exactly described evidence for both required kinds, using this shape: '
                    '[{"check_type":"unit_test","command":"<executed command>","status":"passed",'
                    '"summary":"<real result>","exit_code":0},{"check_type":"smoke_test",'
                    '"command":"<executed command>","status":"passed","summary":"<real result>",'
                    '"exit_code":0}]. Do not invent commands, exit codes, changed files, or results.'
                )
            instruction = (
                "Implement the approved development document"
                if task_type == "development"
                else "Fix the verified code failure or rejected implementation feedback"
            )
            if isinstance(retry_context, dict):
                common += (
                    "Existing code changes from the previous attempt are preserved. Do not implement them again. "
                    "Fix the test command or other reported problem, use the correct repository directory, and "
                    "rerun the required unit test and smoke test before returning the development report.\n\n"
                )
            return common + (
                f"{instruction} in the provided requirement-scoped repositories. "
                "Modify only files under the workspace. Run the smallest relevant unit test and one simple smoke "
                "check using the installed runtimes; do not perform a broad end-to-end test campaign. "
                "Do not push or merge. "
                "Do not invent test results or add substitute scripts merely to claim success. "
                'Return only JSON with "output_summary" and "artifact_content". artifact_content must contain a '
                "clear English implementation summary, changed files, requirement "
                "mapping, the unit/smoke commands and real results, residual risks, manual actions, and implementation "
                "checklist. Set tests_passed=true only when both checks pass. checks must contain one unit_test and "
                "one smoke_test entry; each must include check_type, command, status, summary, and the real "
                "exit_code=0. Use this exact checks JSON shape: "
                '[{"check_type":"unit_test","command":"<executed command>","status":"passed",'
                '"summary":"<real result>","exit_code":0},{"check_type":"smoke_test",'
                '"command":"<executed command>","status":"passed","summary":"<real result>",'
                '"exit_code":0}]. Do not return manual test cases at this stage.'
            )
        if task_type == "test_plan_generation":
            return common + (
                "Read the approved requirement, development document, development report, and current code without "
                "modifying files. Do not run a full test campaign and do not claim that manual tests were executed. "
                'Return only JSON with "output_summary" and "artifact_content". artifact_content must contain these '
                "non-empty fields: test_scope, test_environment, preconditions, risk_points, entry_criteria, "
                "exit_criteria, and manual_test_cases. All list fields must be non-empty. Every manual_test_cases item "
                "must contain non-empty id, title, preconditions, steps, expected_result, priority, and exactly "
                "automated=false. Write every human-readable value in English."
            )
        raise RuntimeError(f"Unsupported Agent task type {task_type}")

    def _parse_result(self, task_type: str, text: str) -> dict[str, Any]:
        stripped = text.strip()
        if stripped.startswith("```"):
            lines = stripped.splitlines()
            stripped = "\n".join(lines[1:-1]).strip()
        repaired = False
        try:
            payload = json.loads(stripped)
        except json.JSONDecodeError:
            start, end = stripped.find("{"), stripped.rfind("}")
            if start < 0 or end <= start:
                raise RuntimeError("Agent response is not valid JSON") from None
            try:
                payload = repair_json(
                    stripped[start : end + 1],
                    return_objects=True,
                    skip_json_loads=True,
                )
            except (TypeError, ValueError):
                raise RuntimeError("Agent response is not valid JSON") from None
            repaired = True
        if not isinstance(payload, dict):
            raise RuntimeError("Agent response must be a JSON object")
        if self._contains_chinese_text(payload):
            raise AgentResponseNotEnglish(
                "Agent response must use English only; Chinese characters were found in the final JSON"
            )
        result: dict[str, Any] = {
            "output_summary": str(payload.get("output_summary") or "Agent task completed"),
            "logs": [
                "OpenCode task completed",
                *(["Malformed Agent JSON was repaired"] if repaired else []),
            ],
        }
        if task_type == "clarification_generate":
            questions = payload.get("clarification_questions")
            if not isinstance(questions, list) or not questions:
                raise RuntimeError("Clarification Agent returned no questions")
            normalized_questions = []
            type_aliases = {
                "single_choice": "single",
                "multi_choice": "multiple",
                "multiple_choice": "multiple",
                "free_text": "text",
            }
            for question_index, question in enumerate(questions, start=1):
                if not isinstance(question, dict) or not str(question.get("question") or "").strip():
                    raise RuntimeError("Clarification Agent returned an invalid question")
                options = []
                for option_index, option in enumerate(question.get("options") or [], start=1):
                    if isinstance(option, str):
                        options.append({"id": f"q{question_index}-option-{option_index}", "label": option})
                    elif isinstance(option, dict):
                        normalized = dict(option)
                        normalized.setdefault("id", f"q{question_index}-option-{option_index}")
                        normalized.setdefault("label", str(option.get("value") or option.get("id") or ""))
                        options.append(normalized)
                normalized_questions.append(
                    {
                        "question": str(question["question"]),
                        "question_type": type_aliases.get(
                            str(question.get("question_type") or "text"),
                            str(question.get("question_type") or "text"),
                        ),
                        "required": bool(question.get("required", True)),
                        "options": options,
                        "ai_recommendation": str(question.get("ai_recommendation") or ""),
                    }
                )
            result["clarification_questions"] = normalized_questions
        else:
            if "artifact_content" not in payload:
                raise RuntimeError("Agent response is missing artifact_content")
            artifact_type = TASK_ARTIFACT_TYPES[task_type]
            try:
                result["artifact_content"] = normalize_artifact_content(artifact_type, payload["artifact_content"])
            except ValidationError as exc:
                if task_type != "test_plan_generation":
                    raise RuntimeError(f"Agent artifact validation failed: {exc}") from exc
                raise RuntimeError(f"Test plan validation failed: {format_validation_error(exc)}") from exc
        return result

    @staticmethod
    def _contains_chinese_text(value: Any, field_name: str | None = None) -> bool:
        if isinstance(value, str):
            if field_name in {
                "changed_files",
                "command",
                "commit",
                "head_commit",
                "path",
                "tested_commit",
                "url",
                "working_directory",
            }:
                return False
            return re.search(r"[\u3400-\u4dbf\u4e00-\u9fff]", value) is not None
        if isinstance(value, list):
            return any(AgentRuntime._contains_chinese_text(item, field_name) for item in value)
        if isinstance(value, dict):
            return any(
                AgentRuntime._contains_chinese_text(item, str(key))
                for key, item in value.items()
            )
        return False

    @staticmethod
    def _validate_result_contract(
        task_type: str,
        result: dict[str, Any],
    ) -> None:
        if task_type not in {"development", "failure_fix"}:
            return
        artifact_content = result.get("artifact_content")
        if not isinstance(artifact_content, dict):
            raise RuntimeError("Development result is missing artifact_content")
        reconcile_development_report(artifact_content)
        try:
            validate_development_report(artifact_content)
        except ValueError as exc:
            raise RuntimeError(str(exc)) from exc

    async def _verify_read_only_workspaces(self, context: dict[str, Any]) -> None:
        manager = self._workspace_manager(context.get("requirement_id"))
        for workspace in context["workspaces"]:
            current = await manager.status(workspace["path"])
            if str(current.get("head_commit") or "") != str(workspace.get("head_commit") or ""):
                raise RuntimeError("Read-only Agent changed the workspace HEAD commit")

    async def _reconcile_report_changed_files(
        self,
        task_id: int,
        context: dict[str, Any],
        result: dict[str, Any],
    ) -> dict[str, Any]:
        """Compatibility helper for callers that explicitly request workspace metadata.

        The Agent execution path no longer calls this helper.  It is retained for
        read-only diagnostics and never participates in result validation.
        """
        artifact = result.get("artifact_content")
        if not isinstance(artifact, dict):
            return result
        existing = artifact.get("changed_files")
        if isinstance(existing, list) and any(
            isinstance(item, dict) and str(item.get("path") or "").strip()
            for item in existing
        ):
            return result
        manager = self._workspace_manager(context.get("requirement_id"))
        reconciled: list[dict[str, str]] = []
        for workspace in context.get("workspaces", []):
            try:
                status = await manager.status(workspace["path"])
            except Exception:
                continue
            raw_files = status.get("changed_files")
            if not isinstance(raw_files, list):
                continue
            for item in raw_files:
                if isinstance(item, str) and item.strip():
                    reconciled.append({"path": item.strip(), "change": "modified"})
                elif isinstance(item, dict) and str(item.get("path") or "").strip():
                    reconciled.append(
                        {
                            "path": str(item["path"]).strip(),
                            "change": str(item.get("change") or "modified"),
                        }
                    )
        if reconciled:
            artifact["changed_files"] = reconciled
            await self._log(task_id, "info", f"Reconciled {len(reconciled)} changed file(s) from workspace status")
        return result

    async def _commit_changes(
        self,
        task_id: int,
        context: dict[str, Any],
        result: dict[str, Any],
    ) -> dict[str, Any]:
        manager = self._workspace_manager(context.get("requirement_id"))
        commits = []
        async with async_session() as session:
            for workspace_data in context["workspaces"]:
                commit = await manager.commit(
                    workspace_data["path"],
                    f"feat(req-{context['requirement_id']}): {context['title'][:80]}",
                    workspace_data["baseline_commit"],
                )
                workspace = await session.get(RequirementWorkspace, workspace_data["id"])
                if workspace is not None:
                    workspace.head_commit = str(commit.get("head_commit") or workspace.head_commit)
                    workspace.changed_files = list(commit.get("changed_files") or [])
                    workspace.status = "committed" if commit.get("committed") else "ready"
                    workspace.version += 1
                commits.append({"workspace_id": workspace_data["id"], **commit})
            await session.commit()
        artifact = result.get("artifact_content")
        if isinstance(artifact, dict):
            artifact["git_commits"] = commits
        result["logs"] = [*result.get("logs", []), f"Committed {len(commits)} workspace(s)"]
        return result

    async def _report_result(self, task_id: int, payload: dict[str, Any]) -> None:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self.settings.AGENT_INTERNAL_API_URL.rstrip('/')}/internal/agent-tasks/{task_id}/result",
                json=payload,
                headers={"Authorization": f"Bearer {self.settings.AGENT_CALLBACK_TOKEN}"},
            )
            if response.status_code >= 400:
                raise RuntimeError(
                    f"Dagent callback rejected the Agent result ({response.status_code}): "
                    f"{response.text[:2000]}"
                )
