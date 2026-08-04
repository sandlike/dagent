import json
from pathlib import Path
from textwrap import dedent

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from dagent.api.schemas.artifacts import normalize_artifact_content
from dagent.config import get_settings
from dagent.db.session import async_session
from dagent.models import (
    AgentDefinition,
    AgentTask,
    AgentVersion,
    AuditLog,
    ModelRoute,
    Repository,
    RequirementWorkspace,
)
from dagent.services.agent_runtime import AgentRuntime, AgentTaskCancelled, OutputFormatJsonSchemaIncompatible
from dagent.services.credentials import decrypt_git_token, encrypt_git_token
from dagent.services.workspaces import resolve_repository_credential


def payload(response):
    assert response.status_code < 400, response.text
    body = response.json()
    assert body["code"] == 0
    return body["data"]


def test_clarification_agent_output_normalizes_string_options():
    runtime = AgentRuntime(get_settings())
    result = runtime._parse_result(
        "clarification_generate",
        json.dumps(
            {
                "output_summary": "One question",
                "clarification_questions": [
                    {
                        "question": "Choose a framework",
                        "question_type": "single_choice",
                        "required": True,
                        "options": ["pytest", "unittest"],
                    }
                ],
            }
        ),
    )
    question = result["clarification_questions"][0]
    assert question["question_type"] == "single"
    assert question["options"] == [
        {"id": "q1-option-1", "label": "pytest"},
        {"id": "q1-option-2", "label": "unittest"},
    ]


async def test_agent_runtime_posts_without_format_then_reads_message_history(monkeypatch):
    runtime = AgentRuntime(get_settings())
    posted_payloads = []
    history_reads = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal history_reads
        if request.method == "GET":
            history_reads += 1
            if history_reads == 1:
                return httpx.Response(200, json=[])
            return httpx.Response(
                200,
                json=[
                    {
                        "info": {"id": "assistant-start", "role": "assistant", "finish": "tool-calls"},
                        "parts": [],
                    },
                    {
                        "info": {"id": "assistant-final", "role": "assistant", "finish": "stop"},
                        "parts": [
                            {
                                "type": "text",
                                "text": json.dumps(
                                    {
                                        "output_summary": "done",
                                        "clarification_questions": [],
                                    }
                                ),
                            }
                        ],
                    }
                ],
            )
        posted_payloads.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={"info": {"id": "assistant-start", "role": "assistant", "finish": "tool-calls"}, "parts": []},
        )

    original_client = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        return original_client(*args, transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", client_factory)
    response, evidence = await runtime._send_prompt(
        "ses-new",
        {
            "task_id": 1,
            "requirement_id": 2,
            "title": "Clarify",
            "description": "Clarify a requirement",
            "input_summary": "Generate questions",
            "task_type": "clarification_generate",
            "task_mode": "requirement_clarification",
            "workspace_root": "/workspaces/requirement-2",
            "workspaces": [],
            "artifacts": {},
            "review_feedback": [],
            "checkpoint": {"agent_snapshot": {"role_type": "requirement_clarification"}},
        },
    )

    assert history_reads == 2
    assert len(posted_payloads) == 1
    assert "format" not in posted_payloads[0]
    assert json.loads(response)["output_summary"] == "done"
    assert evidence == []


async def test_incompatible_output_format_replaces_session_and_retries_once(monkeypatch):
    runtime = AgentRuntime(get_settings())
    sent_sessions = []
    replacement_reasons = []
    reports = []
    context = {
        "task_id": 9,
        "requirement_id": 3,
        "title": "Clarify",
        "description": "Clarify a requirement",
        "input_summary": "Generate questions",
        "task_type": "clarification_generate",
        "task_mode": "requirement_clarification",
        "workspace_root": "/workspaces/requirement-3",
        "workspaces": [],
        "artifacts": {},
        "review_feedback": [],
        "checkpoint": {"agent_snapshot": {}},
    }

    async def prepare_context(task_id):
        return context

    async def ensure_session(task_id, current_context):
        return "ses-dirty"

    async def send_prompt(session_id, current_context):
        sent_sessions.append(session_id)
        if session_id == "ses-dirty":
            raise OutputFormatJsonSchemaIncompatible("incompatible history")
        return (
            json.dumps(
                {
                    "output_summary": "done",
                    "clarification_questions": [
                        {
                            "question": "Which behavior is required?",
                            "question_type": "text",
                            "required": True,
                            "options": [],
                        }
                    ],
                }
            ),
            [],
        )

    async def replace_session(task_id, current_context, reason):
        replacement_reasons.append(reason)
        return "ses-clean"

    async def report_result(task_id, result):
        reports.append(result)

    async def no_op(*args, **kwargs):
        return None

    monkeypatch.setattr(runtime, "_prepare_context", prepare_context)
    monkeypatch.setattr(runtime, "_ensure_session", ensure_session)
    monkeypatch.setattr(runtime, "_send_prompt", send_prompt)
    monkeypatch.setattr(runtime, "_replace_session", replace_session)
    monkeypatch.setattr(runtime, "_report_result", report_result)
    monkeypatch.setattr(runtime, "_verify_read_only_workspaces", no_op)
    monkeypatch.setattr(runtime, "_log", no_op)

    await runtime._execute(9)

    assert sent_sessions == ["ses-dirty", "ses-clean"]
    assert replacement_reasons == ["output_format_incompatible"]
    assert reports[-1]["status"] == "succeeded"


def test_output_format_schema_error_is_detected_from_opencode_response():
    response = httpx.Response(
        400,
        text='{"error":{"name":"OutputFormatJsonSchema","message":"invalid response schema"}}',
    )
    with pytest.raises(OutputFormatJsonSchemaIncompatible):
        AgentRuntime._raise_if_output_format_incompatible(response)


def test_agent_roles_route_to_independent_opencode_services():
    runtime = AgentRuntime(get_settings())
    assert runtime._server_url_for_role("requirement_clarification").endswith("dagent-requirement-agent:4096")
    assert runtime._server_url_for_role("development").endswith("dagent-development-agent:4096")


async def test_opencode_400_body_is_redacted_before_task_logging(monkeypatch):
    settings = get_settings().model_copy(update={"OPENCODE_SERVER_PASSWORD": "private-password"})
    runtime = AgentRuntime(settings)
    messages = []

    async def log(task_id, level, message):
        messages.append((task_id, level, message))

    monkeypatch.setattr(runtime, "_log", log)
    await runtime._inspect_opencode_response(
        7,
        httpx.Response(400, text="password=private-password token=private-password"),
    )

    assert messages == [(7, "error", "OpenCode HTTP 400: password=<redacted> token=<redacted>")]


async def test_opencode_history_poll_stops_before_next_request_when_task_is_cancelled(monkeypatch):
    runtime = AgentRuntime(get_settings())

    async def cancelled(task_id):
        assert task_id == 34
        raise AgentTaskCancelled("cancelled")

    class Client:
        async def get(self, *args, **kwargs):
            raise AssertionError("OpenCode history must not be polled after cancellation")

    monkeypatch.setattr(runtime, "_raise_if_task_cancelled", cancelled)

    with pytest.raises(AgentTaskCancelled):
        await runtime._wait_for_message_completion(
            Client(),
            "http://opencode/session/ses-old/message",
            "/workspaces/requirement-3",
            34,
            set(),
            {},
        )


async def test_cancelled_agent_execution_does_not_report_a_failed_result(monkeypatch):
    runtime = AgentRuntime(get_settings())
    reports = []
    logs = []
    context = {
        "task_id": 34,
        "requirement_id": 3,
        "task_type": "clarification_generate",
        "task_mode": "requirement_clarification",
        "workspace_root": "/workspaces/requirement-3",
    }

    async def prepare_context(task_id):
        assert task_id == 34
        return context

    async def ensure_session(task_id, current_context):
        return "ses-old"

    async def send_prompt(session_id, current_context):
        raise AgentTaskCancelled("cancelled")

    async def report_result(task_id, result):
        reports.append(result)

    async def log(task_id, level, message):
        logs.append((level, message))

    monkeypatch.setattr(runtime, "_prepare_context", prepare_context)
    monkeypatch.setattr(runtime, "_ensure_session", ensure_session)
    monkeypatch.setattr(runtime, "_send_prompt", send_prompt)
    monkeypatch.setattr(runtime, "_report_result", report_result)
    monkeypatch.setattr(runtime, "_log", log)

    await runtime._execute(34)

    assert reports == []
    assert logs[-1] == ("info", "Agent execution stopped after task cancellation")


def test_legacy_artifact_content_is_normalized_for_readable_rendering():
    test_cases = normalize_artifact_content(
        "test_cases",
        {"test_cases": [{"id": "TC-1", "expected": "prints Hello, world!"}]},
    )
    assert test_cases["schema_version"] == 1
    assert test_cases["cases"][0]["title"] == "TC-1"
    assert test_cases["cases"][0]["expected_result"] == "prints Hello, world!"
    assert "test_cases" not in test_cases

    report = normalize_artifact_content("test_report", {"passed": 2, "failed": 1, "skipped": 0})
    assert report["totals"] == {"passed": 2, "failed": 1, "skipped": 0, "blocked": 0}


def test_agent_prompt_contains_review_feedback():
    runtime = AgentRuntime(get_settings())
    prompt = runtime._build_prompt(
        {
            "task_id": 8,
            "requirement_id": 3,
            "title": "Handle review feedback",
            "description": "Fix the implementation.",
            "input_summary": "Continue development",
            "workspace_root": "/workspaces/requirement-3",
            "workspaces": [],
            "artifacts": {},
            "review_feedback": [
                {
                    "gate": "development_report",
                    "action": "reject",
                    "artifact_version": 1,
                    "reviewer_id": 4,
                    "comment": "补充异常路径测试",
                    "created_at": "2026-08-01T13:00:00+00:00",
                }
            ],
            "checkpoint": {"agent_snapshot": {}},
            "task_type": "development",
        }
    )
    assert "补充异常路径测试" in prompt
    assert "unresolved rejection feedback" in prompt
    assert "Return English only" in prompt
    assert "even when the requirement, user input" in prompt


def test_agent_runtime_accepts_both_opencode_structured_output_fields():
    runtime = AgentRuntime(get_settings())
    expected = {"output_summary": "ready", "artifact_content": {"scope": []}}
    for field in ("structured", "structured_output"):
        content = runtime._response_content({"info": {field: expected}, "parts": []})
        assert json.loads(content) == expected


def test_agent_runtime_surfaces_opencode_errors():
    runtime = AgentRuntime(get_settings())
    try:
        runtime._response_content(
            {"info": {"error": {"name": "APIError", "data": {"message": "rate limited"}}}}
        )
    except RuntimeError as exc:
        assert str(exc) == "OpenCode failed: rate limited"
    else:
        raise AssertionError("OpenCode error response must fail the task")


def test_clarification_result_repairs_unescaped_quotes_from_llm():
    runtime = AgentRuntime(get_settings())
    response = """
    {
      "output_summary": "Clarification complete",
      "clarification_questions": [
        {
          "question": "Which output mode is required?",
          "question_type": "single",
          "required": true,
          "options": ["Standard output", "File output"],
          "ai_recommendation": "The requirement says "keep it simple", so use standard output."
        }
      ]
    }
    """

    result = runtime._parse_result("clarification_generate", response)

    assert result["clarification_questions"][0]["ai_recommendation"] == (
        'The requirement says "keep it simple", so use standard output.'
    )
    assert "Malformed Agent JSON was repaired" in result["logs"]


def test_agent_result_rejects_chinese_text_even_when_json_is_valid():
    runtime = AgentRuntime(get_settings())
    response = json.dumps(
        {
            "output_summary": "Clarification complete",
            "clarification_questions": [
                {
                    "question": "Which output mode is required?",
                    "question_type": "text",
                    "required": True,
                    "options": [],
                    "ai_recommendation": "使用标准输出",
                }
            ],
        },
        ensure_ascii=False,
    )

    with pytest.raises(RuntimeError, match="must use English only"):
        runtime._parse_result("clarification_generate", response)


def test_agent_english_validation_preserves_technical_identifiers():
    runtime = AgentRuntime(get_settings())
    response = json.dumps(
        {
            "output_summary": "Implementation complete",
            "artifact_content": {
                "summary": "Implemented the requested change",
                "tests_passed": True,
                "changed_files": [{"path": "src/中文模块.py", "change": "Added validation"}],
                "requirement_mapping": [
                    {"requirement": "Validate input", "implementation": "Added validation"}
                ],
                "checks": [
                    {
                        "check_type": "unit_test",
                        "command": "pytest tests/中文测试.py",
                        "status": "passed",
                        "summary": "Unit tests passed",
                        "exit_code": 0,
                    },
                    {
                        "check_type": "smoke_test",
                        "command": "python src/中文模块.py",
                        "status": "passed",
                        "summary": "Smoke test passed",
                        "exit_code": 0,
                    },
                ],
                "implementation_checklist": [{"item": "Validation added", "status": "done"}],
            },
        },
        ensure_ascii=False,
    )

    result = runtime._parse_result("development", response)

    assert result["artifact_content"]["changed_files"][0]["path"] == "src/中文模块.py"


async def test_non_english_agent_result_is_corrected_once_in_same_session(monkeypatch):
    runtime = AgentRuntime(get_settings())
    chinese = json.dumps(
        {
            "output_summary": "澄清完成",
            "clarification_questions": [
                {
                    "question": "需要哪种输出方式？",
                    "question_type": "text",
                    "required": True,
                    "options": [],
                    "ai_recommendation": "使用标准输出",
                }
            ],
        },
        ensure_ascii=False,
    )
    english = json.dumps(
        {
            "output_summary": "Clarification complete",
            "clarification_questions": [
                {
                    "question": "Which output mode is required?",
                    "question_type": "text",
                    "required": True,
                    "options": [],
                    "ai_recommendation": "Use standard output",
                }
            ],
        }
    )
    prompts: list[tuple[str, str | None]] = []
    reports: list[dict] = []

    async def prepare_context(_task_id):
        return {
            "task_id": 44,
            "requirement_id": 8,
            "title": "生成命令行工具",
            "description": "用最简单的方式实现。",
            "input_summary": "Generate clarification questions",
            "task_type": "clarification_generate",
            "task_mode": "requirement_clarification",
            "workspace_root": "/workspaces/requirement-8",
            "workspaces": [],
            "artifacts": {},
            "review_feedback": [],
            "checkpoint": {"agent_snapshot": {"role_type": "requirement_clarification"}},
        }

    async def ensure_session(_task_id, _context):
        return "ses-requirement-main"

    async def send_prompt(session_id, _context, correction_error=None):
        prompts.append((session_id, correction_error))
        return (chinese if correction_error is None else english), []

    async def report_result(_task_id, result):
        reports.append(result)

    async def no_op(*_args, **_kwargs):
        return None

    monkeypatch.setattr(runtime, "_prepare_context", prepare_context)
    monkeypatch.setattr(runtime, "_ensure_session", ensure_session)
    monkeypatch.setattr(runtime, "_send_prompt", send_prompt)
    monkeypatch.setattr(runtime, "_verify_read_only_workspaces", no_op)
    monkeypatch.setattr(runtime, "_report_result", report_result)
    monkeypatch.setattr(runtime, "_log", no_op)

    await runtime._execute(44)

    assert len(prompts) == 2
    assert prompts[0] == ("ses-requirement-main", None)
    assert prompts[1][0] == "ses-requirement-main"
    assert "English only" in str(prompts[1][1])
    assert reports[-1]["status"] == "succeeded"


def test_development_result_does_not_require_manual_test_cases():
    runtime = AgentRuntime(get_settings())
    response = json.dumps(
        {
            "output_summary": "implementation and minimal checks completed",
            "artifact_content": {
                "tests_passed": True,
                "changed_files": [{"path": "src/service.py", "change": "Added validation"}],
                "checks": [
                    {
                        "check_type": "unit_test",
                        "command": "pytest -q",
                        "status": "passed",
                        "summary": "Unit tests passed",
                        "exit_code": 0,
                    },
                    {
                        "check_type": "smoke_test",
                        "command": "python smoke.py",
                        "status": "passed",
                        "summary": "Smoke check passed",
                        "exit_code": 0,
                    },
                ],
            },
        }
    )
    result = runtime._parse_result("development", response)
    assert result["artifact_content"]["checks"][0]["check_type"] == "unit_test"
    assert "test_cases" not in result


def test_development_report_contract_reconciles_agent_aliases_without_tool_evidence():
    runtime = AgentRuntime(get_settings())
    response = json.dumps(
        {
            "output_summary": "implementation and checks completed",
            "artifact_content": {
                "tests_passed": True,
                "changed_files": [{"path": "src/service.py", "change": "Added validation"}],
                "checks": [
                    {
                        "name": "pytest unit tests",
                        "command": "pytest -q",
                        "status": "passed",
                        "summary": "Unit tests passed",
                        "exit_code": 0,
                    },
                    {
                        "type": "health_check",
                        "command": "python smoke.py",
                        "status": "passed",
                        "summary": "Smoke check passed",
                        "exit_code": 0,
                    },
                ],
            },
        }
    )
    result = runtime._parse_result("development", response)

    runtime._validate_result_contract("development", result)

    assert result["artifact_content"]["checks"][0]["check_type"] == "unit_test"
    assert result["artifact_content"]["checks"][1]["check_type"] == "smoke_test"
    assert [item["exit_code"] for item in result["artifact_content"]["checks"]] == [0, 0]


def test_development_report_contract_rejects_reported_failed_exit_code():
    runtime = AgentRuntime(get_settings())
    response = json.dumps(
        {
            "artifact_content": {
                "tests_passed": True,
                "changed_files": [{"path": "src/service.py", "change": "Added validation"}],
                "checks": [
                    {
                        "check_type": "unit_test",
                        "command": "pytest -q",
                        "status": "passed",
                        "summary": "Claimed success",
                        "exit_code": 0,
                    },
                    {
                        "check_type": "smoke_test",
                        "command": "python smoke.py",
                        "status": "passed",
                        "summary": "Claimed success",
                        "exit_code": 1,
                    },
                ],
            },
        }
    )
    result = runtime._parse_result("development", response)

    with pytest.raises(RuntimeError, match="smoke_test.exit_code must be 0"):
        runtime._validate_result_contract("development", result)


def test_test_plan_result_requires_complete_manual_cases():
    runtime = AgentRuntime(get_settings())
    invalid = json.dumps(
        {
            "output_summary": "draft test plan",
            "artifact_content": {
                "test_scope": ["Order risk limit"],
                "manual_test_cases": [{"id": "TC-1", "title": "Missing required fields"}],
            },
        }
    )
    with pytest.raises(RuntimeError, match="test_environment"):
        runtime._parse_result("test_plan_generation", invalid)

    valid = json.dumps(
        {
            "output_summary": "test plan ready",
            "artifact_content": {
                "test_scope": ["Order risk limit"],
                "test_environment": ["Staging environment"],
                "preconditions": ["Risk limit is configured"],
                "risk_points": ["Boundary amount handling"],
                "entry_criteria": ["Development report approved"],
                "exit_criteria": ["All P0 manual cases pass"],
                "manual_test_cases": [
                    {
                        "id": "TC-1",
                        "title": "Reject an excessive order",
                        "preconditions": ["Risk limit is CNY 1,000,000"],
                        "steps": ["Submit an order above the limit"],
                        "expected_result": "The order is rejected",
                        "priority": "P0",
                        "automated": False,
                    }
                ],
            },
        }
    )
    result = runtime._parse_result("test_plan_generation", valid)
    assert result["artifact_content"]["manual_test_cases"][0]["automated"] is False


async def test_test_plan_validation_correction_uses_same_session_once(monkeypatch):
    runtime = AgentRuntime(get_settings())
    invalid = json.dumps(
        {
            "output_summary": "incomplete",
            "artifact_content": {
                "test_scope": ["Order risk limit"],
                "manual_test_cases": [],
            },
        }
    )
    prompts: list[tuple[str, str | None]] = []
    reports: list[dict] = []

    async def prepare_context(_task_id):
        return {
            "task_id": 45,
            "requirement_id": 9,
            "title": "Generate a test plan",
            "description": "Cover the approved implementation.",
            "input_summary": "Generate manual test guidance",
            "task_type": "test_plan_generation",
            "task_mode": "test_plan",
            "workspace_root": "/workspaces/requirement-9",
            "workspaces": [],
            "artifacts": {},
            "review_feedback": [],
            "checkpoint": {"agent_snapshot": {"role_type": "development"}},
        }

    async def ensure_session(_task_id, _context):
        return "ses-development-main"

    async def send_prompt(session_id, _context, correction_error=None):
        prompts.append((session_id, correction_error))
        return invalid, []

    async def report_result(_task_id, result):
        reports.append(result)

    async def no_op(*_args, **_kwargs):
        return None

    monkeypatch.setattr(runtime, "_prepare_context", prepare_context)
    monkeypatch.setattr(runtime, "_ensure_session", ensure_session)
    monkeypatch.setattr(runtime, "_send_prompt", send_prompt)
    monkeypatch.setattr(runtime, "_verify_read_only_workspaces", no_op)
    monkeypatch.setattr(runtime, "_report_result", report_result)
    monkeypatch.setattr(runtime, "_log", no_op)

    await runtime._execute(45)

    assert len(prompts) == 2
    assert prompts[0] == ("ses-development-main", None)
    assert prompts[1][0] == "ses-development-main"
    assert "test_environment" in str(prompts[1][1])
    assert reports[-1]["status"] == "failed"
    assert reports[-1]["logs"] == []


async def test_development_report_validation_correction_uses_same_session_once(monkeypatch):
    runtime = AgentRuntime(get_settings())
    invalid = json.dumps(
        {
            "output_summary": "incomplete report",
            "artifact_content": {
                "tests_passed": True,
                "changed_files": [{"path": "src/service.py", "change": "Added validation"}],
                "checks": [],
            },
        }
    )
    corrected = json.dumps(
        {
            "output_summary": "corrected report",
            "artifact_content": {
                "tests_passed": True,
                "changed_files": [{"path": "src/service.py", "change": "Added validation"}],
                "checks": [
                    {
                        "check_type": "unit_tests",
                        "command": "pytest -q",
                        "status": "passed",
                        "summary": "12 passed",
                        "exit_code": 0,
                    },
                    {
                        "check_type": "smoke",
                        "command": "python smoke.py",
                        "status": "passed",
                        "summary": "healthy",
                        "exit_code": 0,
                    },
                ],
            },
        }
    )
    prompts: list[tuple[str, str | None]] = []
    reports: list[dict] = []

    async def prepare_context(_task_id):
        return {
            "task_id": 46,
            "requirement_id": 10,
            "title": "Implement validation",
            "description": "Add the approved validation.",
            "input_summary": "Implement and run minimal checks",
            "task_type": "development",
            "task_mode": "implementation",
            "workspace_root": "/workspaces/requirement-10",
            "workspaces": [],
            "artifacts": {},
            "review_feedback": [],
            "checkpoint": {"agent_snapshot": {"role_type": "development"}},
        }

    async def ensure_session(_task_id, _context):
        return "ses-development-main"

    async def send_prompt(session_id, _context, correction_error=None):
        prompts.append((session_id, correction_error))
        return (invalid, []) if correction_error is None else (corrected, [])

    async def report_result(_task_id, result):
        reports.append(result)

    async def no_op(*_args, **_kwargs):
        return None

    async def commit_changes(_task_id, _context, result):
        return result

    monkeypatch.setattr(runtime, "_prepare_context", prepare_context)
    monkeypatch.setattr(runtime, "_ensure_session", ensure_session)
    monkeypatch.setattr(runtime, "_send_prompt", send_prompt)
    monkeypatch.setattr(runtime, "_commit_changes", commit_changes)
    monkeypatch.setattr(runtime, "_report_result", report_result)
    monkeypatch.setattr(runtime, "_log", no_op)

    await runtime._execute(46)

    assert len(prompts) == 2
    assert prompts[0] == ("ses-development-main", None)
    assert prompts[1][0] == "ses-development-main"
    assert "unit_test" in str(prompts[1][1])
    assert reports[-1]["status"] == "succeeded"
    assert reports[-1]["artifact_content"]["checks"][1]["check_type"] == "smoke_test"


def test_task_modes_disable_child_agents_and_enforce_read_only_tools():
    runtime = AgentRuntime(get_settings())
    assert runtime._tools_for_mode("implementation") == {"task": False}
    read_only = runtime._tools_for_mode("development_document")
    assert read_only == {
        "task": False,
        "edit": False,
        "write": False,
        "apply_patch": False,
        "bash": False,
    }
    assert runtime._tools_for_mode("test_plan") == read_only


def test_development_agent_bash_uses_denylist_instead_of_allowlist():
    manifest = Path("k8s/agent/development-agent.yaml").read_text(encoding="utf-8")
    config_block = dedent(manifest.split("opencode.json: |", 1)[1].split("\n---", 1)[0])
    config = json.loads(config_block)

    expected_bash_policy = {
        "*": "allow",
        "git reset*": "deny",
        "git push*": "deny",
        "git merge*": "deny",
        "rm -rf *": "deny",
    }
    assert config["agent"]["development"]["permission"]["bash"] == expected_bash_policy
    assert config["permission"]["bash"] == expected_bash_policy


async def test_default_development_agent_snapshot_does_not_advertise_a_shell_allowlist():
    async with async_session() as session:
        version = await session.scalar(
            select(AgentVersion)
            .join(AgentDefinition, AgentDefinition.id == AgentVersion.agent_id)
            .where(AgentDefinition.role_type == "development", AgentDefinition.default_flag.is_(True))
            .order_by(AgentVersion.version.desc())
        )

    assert version is not None
    assert version.tool_policy["shell"] is True


async def test_read_only_workspace_verification_ignores_changed_file_list_mismatch(monkeypatch):
    runtime = AgentRuntime(get_settings())

    class Manager:
        def __init__(self, _settings):
            pass

        async def status(self, path):
            assert path == "/workspaces/requirement-7/repository"
            return {"head_commit": "commit-2", "changed_files": []}

    monkeypatch.setattr("dagent.services.agent_runtime.WorkspaceManagerClient", Manager)

    await runtime._verify_read_only_workspaces(
        {
            "workspaces": [
                {
                    "path": "/workspaces/requirement-7/repository",
                    "head_commit": "commit-2",
                    "changed_files": ["hello_world.py"],
                }
            ]
        }
    )


async def test_read_only_workspace_verification_still_rejects_head_change(monkeypatch):
    runtime = AgentRuntime(get_settings())

    class Manager:
        def __init__(self, _settings):
            pass

        async def status(self, _path):
            return {"head_commit": "unexpected-commit", "changed_files": []}

    monkeypatch.setattr("dagent.services.agent_runtime.WorkspaceManagerClient", Manager)

    with pytest.raises(RuntimeError, match="changed the workspace HEAD commit"):
        await runtime._verify_read_only_workspaces(
            {
                "workspaces": [
                    {
                        "path": "/workspaces/requirement-7/repository",
                        "head_commit": "expected-commit",
                        "changed_files": [],
                    }
                ]
            }
        )


def test_opencode_message_history_is_aggregated_until_final_assistant_message():
    runtime = AgentRuntime(get_settings())
    command = "python -m pytest tests/test_login.py -q"
    messages = [
        {"info": {"id": "old", "role": "assistant", "finish": "stop"}, "parts": []},
        {"info": {"id": "user", "role": "user"}, "parts": [{"type": "text", "text": "request"}]},
        {
            "info": {"id": "step-1", "role": "assistant", "finish": "tool-calls"},
            "parts": [
                {
                    "type": "tool",
                    "tool": "bash",
                    "state": {
                        "status": "completed",
                        "input": {"command": command},
                        "output": "1 passed",
                        "metadata": {"exit": 0},
                    },
                }
            ],
        },
        {
            "info": {
                "id": "step-2",
                "role": "assistant",
                "finish": "stop",
                "structured_output": {"output_summary": "passed", "artifact_content": {}},
            },
            "parts": [{"type": "text", "text": "done"}],
        },
    ]
    aggregated, complete = runtime._aggregate_new_assistant_messages(messages, {"old"}, {})
    assert complete is True
    assert aggregated is not None
    assert aggregated["info"]["structured_output"]["output_summary"] == "passed"
    assert runtime._tool_evidence(aggregated) == [
        {"command": command, "exit_code": 0, "evidence": "1 passed"}
    ]


def test_denied_bash_attempt_is_not_treated_as_execution_evidence():
    runtime = AgentRuntime(get_settings())
    evidence = runtime._tool_evidence(
        {
            "parts": [
                {
                    "type": "tool",
                    "tool": "bash",
                    "state": {
                        "status": "error",
                        "input": {"command": "kubectl get secrets"},
                        "error": "permission denied",
                    },
                }
            ]
        }
    )
    assert evidence == []


async def create_requirement(client: AsyncClient, users, key: str):
    project = payload(
        await client.post(
            "/api/v1/projects",
            json={
                "name": f"Platform project {key}",
                "member_ids": [users["developer"]["id"]],
            },
            headers=users["pm"]["headers"],
        )
    )
    repository = payload(
        await client.post(
            f"/api/v1/projects/{project['id']}/repositories",
            json={
                "name": f"repository-{key}",
                "url": "https://example.invalid/repository.git",
                "default_branch": "main",
            },
            headers=users["pm"]["headers"],
        )
    )
    requirement = payload(
        await client.post(
            "/api/v1/requirements",
            json={
                "project_id": project["id"],
                "title": f"Requirement {key}",
                "description": "Exercise platform behavior.",
                "repository_ids": [repository["id"]],
            },
            headers={**users["pm"]["headers"], "Idempotency-Key": f"requirement-{key}"},
        )
    )
    return project, repository, requirement


async def test_repository_credentials_are_encrypted_hidden_and_used_for_verification(
    client: AsyncClient,
    users,
    monkeypatch,
):
    project = payload(
        await client.post(
            "/api/v1/projects",
            json={"name": "Credential project", "member_ids": [users["developer"]["id"]]},
            headers=users["pm"]["headers"],
        )
    )
    repository = payload(
        await client.post(
            f"/api/v1/projects/{project['id']}/repositories",
            json={
                "name": "private-repository",
                "url": "https://git.example.com/team/private-repository.git",
                "default_branch": "main",
            },
            headers=users["pm"]["headers"],
        )
    )
    assert repository["credential_configured"] is False

    denied = await client.put(
        f"/api/v1/repositories/{repository['id']}/credential",
        json={"username": "developer", "token": "must-not-be-stored"},
        headers=users["developer"]["headers"],
    )
    assert denied.status_code == 403

    secret = "github_pat_database_encryption_test"
    configured_response = await client.put(
        f"/api/v1/repositories/{repository['id']}/credential",
        json={"username": "git-user", "token": secret},
        headers=users["pm"]["headers"],
    )
    configured = payload(configured_response)
    assert configured["credential_configured"] is True
    assert secret not in configured_response.text
    assert "credential_username" not in configured
    assert "credential_ciphertext" not in configured
    assert "credential_ref" not in configured

    async with async_session() as session:
        stored = await session.get(Repository, repository["id"])
        assert stored is not None
        assert stored.credential_username == "git-user"
        assert stored.credential_ciphertext and stored.credential_ciphertext != secret
        assert decrypt_git_token(stored.credential_ciphertext) == secret
        resolved = resolve_repository_credential(stored)
        assert resolved is not None
        assert resolved.username == "git-user"
        assert resolved.password == secret

    async def fake_verify(item):
        credential = resolve_repository_credential(item)
        assert credential is not None and credential.password == secret
        return {
            "result": "read_write_success",
            "read_verified": True,
            "write_verified": True,
            "message": "verified",
        }

    monkeypatch.setattr("dagent.api.v1.repositories.verify_repository", fake_verify)
    verification = payload(
        await client.post(
            f"/api/v1/repositories/{repository['id']}/verify",
            headers=users["pm"]["headers"],
        )
    )
    assert verification["result"] == "read_write_success"
    assert verification["read_verified"] is True
    assert verification["write_verified"] is True
    assert verification["repository"]["credential_configured"] is True

    deleted = payload(
        await client.delete(
            f"/api/v1/repositories/{repository['id']}/credential",
            headers=users["pm"]["headers"],
        )
    )
    assert deleted["credential_configured"] is False
    async with async_session() as session:
        stored = await session.get(Repository, repository["id"])
        assert stored is not None
        assert stored.credential_username is None
        assert stored.credential_ciphertext is None
        assert stored.credential_ref is None

    leaked = "credential-must-not-appear"
    invalid = await client.put(
        f"/api/v1/repositories/{repository['id']}/credential",
        json={"username": "git-user", "token": leaked * 300},
        headers=users["pm"]["headers"],
    )
    assert invalid.status_code == 422
    assert leaked not in invalid.text


async def test_project_repository_delete_protects_references_and_removes_orphans(client: AsyncClient, users):
    pm_headers = users["pm"]["headers"]
    first_project = payload(
        await client.post(
            "/api/v1/projects",
            json={"name": "Repository deletion one", "member_ids": [users["developer"]["id"]]},
            headers=pm_headers,
        )
    )
    second_project = payload(
        await client.post(
            "/api/v1/projects",
            json={"name": "Repository deletion two", "member_ids": [users["developer"]["id"]]},
            headers=pm_headers,
        )
    )
    shared_payload = {
        "name": "shared-delete-repository",
        "url": "https://example.invalid/shared-delete-repository.git",
        "default_branch": "main",
    }
    shared_repository = payload(
        await client.post(
            f"/api/v1/projects/{first_project['id']}/repositories",
            json=shared_payload,
            headers=pm_headers,
        )
    )
    rebound_repository = payload(
        await client.post(
            f"/api/v1/projects/{second_project['id']}/repositories",
            json=shared_payload,
            headers=pm_headers,
        )
    )
    assert rebound_repository["id"] == shared_repository["id"]

    denied = await client.delete(
        f"/api/v1/projects/{first_project['id']}/repositories/{shared_repository['id']}",
        headers=users["developer"]["headers"],
    )
    assert denied.status_code == 403

    first_delete = payload(
        await client.delete(
            f"/api/v1/projects/{first_project['id']}/repositories/{shared_repository['id']}",
            headers=pm_headers,
        )
    )
    assert first_delete == {"deleted": True, "repository_deleted": False}
    second_repositories = payload(
        await client.get(
            f"/api/v1/projects/{second_project['id']}/repositories",
            headers=pm_headers,
        )
    )
    assert [item["id"] for item in second_repositories] == [shared_repository["id"]]

    second_delete = payload(
        await client.delete(
            f"/api/v1/projects/{second_project['id']}/repositories/{shared_repository['id']}",
            headers=pm_headers,
        )
    )
    assert second_delete == {"deleted": True, "repository_deleted": True}
    async with async_session() as session:
        assert await session.get(Repository, shared_repository["id"]) is None
        audit = await session.scalar(
            select(AuditLog)
            .where(
                AuditLog.action == "repository.delete",
                AuditLog.resource_id == str(shared_repository["id"]),
            )
            .order_by(AuditLog.id.desc())
        )
        assert audit is not None
        assert audit.details["repository_deleted"] is True
        assert audit.details["remote_repository_deleted"] is False

    protected_repository = payload(
        await client.post(
            f"/api/v1/projects/{first_project['id']}/repositories",
            json={
                "name": "protected-delete-repository",
                "url": "https://example.invalid/protected-delete-repository.git",
                "default_branch": "main",
            },
            headers=pm_headers,
        )
    )
    payload(
        await client.post(
            "/api/v1/requirements",
            json={
                "project_id": first_project["id"],
                "title": "Protect repository deletion",
                "description": "The repository is referenced by this requirement.",
                "repository_ids": [protected_repository["id"]],
            },
            headers={**pm_headers, "Idempotency-Key": "protect-repository-deletion"},
        )
    )
    blocked = await client.delete(
        f"/api/v1/projects/{first_project['id']}/repositories/{protected_repository['id']}",
        headers=pm_headers,
    )
    assert blocked.status_code == 409
    assert "cannot be deleted" in blocked.text


def test_repository_credential_cipher_and_legacy_environment_fallback(monkeypatch):
    token = "plain-token"
    ciphertext = encrypt_git_token(token)
    assert ciphertext != token
    assert decrypt_git_token(ciphertext) == token

    monkeypatch.setenv("LEGACY_GIT_CREDENTIAL", '{"username":"legacy-user","password":"legacy-token"}')
    credential = resolve_repository_credential("env://LEGACY_GIT_CREDENTIAL")
    assert credential is not None
    assert credential.username == "legacy-user"
    assert credential.password == "legacy-token"


async def test_agent_version_management_and_audit_permissions(client: AsyncClient, users):
    async with async_session() as session:
        legacy = AgentDefinition(
            tenant_id=1,
            role_type="development_testing",
            name="Legacy testing child Agent",
            default_flag=False,
        )
        session.add(legacy)
        await session.commit()
        await session.refresh(legacy)
        legacy_id = legacy.id

    listed = payload(await client.get("/api/v1/agent-definitions", headers=users["admin"]["headers"]))
    assert {item["role_type"] for item in listed} <= {
        "requirement_clarification",
        "development",
    }
    hidden = await client.get(
        f"/api/v1/agent-definitions/{legacy_id}",
        headers=users["admin"]["headers"],
    )
    assert hidden.status_code == 404

    denied = await client.post(
        "/api/v1/agent-definitions",
        json={"role_type": "development", "name": "Denied", "default_flag": False},
        headers=users["developer"]["headers"],
    )
    assert denied.status_code == 403

    definition = payload(
        await client.post(
            "/api/v1/agent-definitions",
            json={
                "role_type": "requirement_clarification",
                "name": "Clarification strict",
                "default_flag": False,
            },
            headers=users["admin"]["headers"],
        )
    )
    version = payload(
        await client.post(
            f"/api/v1/agent-definitions/{definition['id']}/versions",
            json={
                "style": "strict",
                "prompt_ref": "opencode://agent/requirement_clarification",
                "skill_policy": ["requirement-elicitation"],
                "mcp_policy": {},
                "tool_policy": {"repository": "read_only"},
            },
            headers=users["admin"]["headers"],
        )
    )
    assert version["status"] == "draft"
    published = payload(
        await client.post(
            f"/api/v1/agent-definitions/{definition['id']}/publish",
            json={"version_id": version["id"]},
            headers=users["admin"]["headers"],
        )
    )
    assert published["versions"][0]["status"] == "published"

    audit_denied = await client.get("/api/v1/audit-logs", headers=users["pm"]["headers"])
    assert audit_denied.status_code == 403
    audit = payload(
        await client.get(
            "/api/v1/audit-logs?action=agent_version.publish",
            headers=users["admin"]["headers"],
        )
    )
    assert any(item["resource_id"] == str(version["id"]) for item in audit)


async def test_failed_result_and_retry_preserve_fixed_agent_checkpoint(client: AsyncClient, users):
    project, repository, requirement = await create_requirement(client, users, "checkpoint")
    requirement = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/submit",
            json={"resource_version": requirement["version"]},
            headers=users["pm"]["headers"],
        )
    )
    task = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/clarification/generate",
            headers={**users["pm"]["headers"], "Idempotency-Key": "checkpoint-task"},
        )
    )
    assert task["checkpoint"]["agent_snapshot"]["role_type"] == "requirement_clarification"
    failed = payload(
        await client.post(
            f"/api/v1/internal/agent-tasks/{task['id']}/result",
            json={
                "status": "failed",
                "error_message": "temporary dependency error",
                "checkpoint": {},
            },
            headers={"Authorization": "Bearer test-agent-token"},
        )
    )
    assert failed["checkpoint"]["agent_snapshot"]["version_id"] == task["agent_version_id"]
    retried = payload(
        await client.post(
            f"/api/v1/agent-tasks/{task['id']}/retry",
            headers={**users["pm"]["headers"], "Idempotency-Key": "checkpoint-retry"},
        )
    )
    assert retried["parent_task_id"] is None
    assert retried["session_id"] == task["session_id"]
    assert retried["checkpoint"]["retry_of_task_id"] == task["id"]
    assert retried["checkpoint"]["agent_snapshot"]["version_id"] == task["agent_version_id"]
    assert "opencode_session_id" not in retried["checkpoint"]


async def test_workspace_push_merge_check_and_merge_queue(client: AsyncClient, users, monkeypatch):
    _, repository, requirement = await create_requirement(client, users, "workspace")
    async with async_session() as session:
        workspace = RequirementWorkspace(
            tenant_id=1,
            requirement_id=requirement["id"],
            repository_id=repository["id"],
            path=f"/workspaces/tenant-1/requirement-{requirement['id']}/repo",
            base_branch="main",
            branch_name=f"dagent/req-{requirement['id']}",
            baseline_commit="a" * 40,
            head_commit="b" * 40,
            status="committed",
            changed_files=["main.py"],
        )
        session.add(workspace)
        await session.commit()
        await session.refresh(workspace)
        workspace_id = workspace.id

    async def fake_push(_self, path, credential):
        assert path.endswith("/repo")
        assert credential is None
        return {"head_commit": "c" * 40, "changed_files": ["main.py"]}

    async def fake_check(_self, path, target_branch, credential=None):
        assert path.endswith("/repo")
        assert target_branch == "main"
        assert credential is None
        return {"can_merge": True, "conflict_files": [], "message": "Merge check passed"}

    async def fake_merge(_self, path, target_branch, credential):
        assert path.endswith("/repo")
        assert target_branch == "main"
        assert credential is None
        return {"head_commit": "d" * 40}

    monkeypatch.setattr("dagent.api.v1.workspaces.WorkspaceManagerClient.push", fake_push)
    monkeypatch.setattr("dagent.api.v1.workspaces.WorkspaceManagerClient.merge_check", fake_check)
    monkeypatch.setattr("dagent.api.v1.workspaces.WorkspaceManagerClient.merge", fake_merge)
    headers = users["developer"]["headers"]

    items = payload(
        await client.get(f"/api/v1/requirements/{requirement['id']}/workspace", headers=headers)
    )
    assert items[0]["changed_files"] == ["main.py"]
    checked = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/merge-check",
            json={"workspace_id": workspace_id, "target_branch": "main"},
            headers=headers,
        )
    )
    assert checked["can_merge"] is True
    pushed = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/workspace/{workspace_id}/push",
            headers=headers,
        )
    )
    assert pushed["status"] == "pushed"
    merged = payload(
        await client.post(
            f"/api/v1/requirements/{requirement['id']}/merge-queue",
            json={"workspace_id": workspace_id, "target_branch": "main"},
            headers={**headers, "Idempotency-Key": "workspace-merge"},
        )
    )
    assert merged["status"] == "merged"


async def test_openai_compatible_proxy_routes_clarification_and_settles_usage(
    client: AsyncClient,
    users,
    monkeypatch,
):
    project, _, requirement = await create_requirement(client, users, "proxy")
    async with async_session() as session:
        route = ModelRoute(
            tenant_id=1,
            name="clarification-proxy-route",
            provider="openai-compatible",
            model="test-model",
            base_url="https://model.example.invalid/v1",
            priority=1,
            quota_limit=10_000,
            fallback_on=["timeout", "server_error", "rate_limited", "quota_exhausted"],
            agent_types=["requirement_clarification"],
            project_ids=[project["id"]],
            environments=["production"],
            status="active",
            health_status="healthy",
        )
        session.add(route)
        await session.flush()
        task = AgentTask(
            tenant_id=1,
            requirement_id=requirement["id"],
            stage="requirement_clarification",
            task_type="clarification_generate",
            idempotency_key="proxy-clarification-task",
        )
        session.add(task)
        await session.commit()
        await session.refresh(task)
        task_id = task.id

    personal_route = payload(
        await client.post(
            "/api/v1/me/model-routes",
            json={
                "platform_route_id": route.id,
                "name": "Clarification proxy personal route",
                "level": "high",
                "priority": 1,
                "quota_limit": 10_000,
            },
            headers=users["pm"]["headers"],
        )
    )
    gateway = payload(await client.get("/api/v1/me/model-gateway", headers=users["pm"]["headers"]))
    clarification_binding = next(
        item for item in gateway["bindings"] if item["agent_type"] == "requirement_clarification"
    )
    payload(
        await client.put(
            "/api/v1/me/agent-model-bindings/requirement_clarification",
            json={
                "route_ids": [personal_route["id"]],
                "resource_version": clarification_binding["resource_version"],
            },
            headers=users["pm"]["headers"],
        )
    )

    class FakeUpstreamClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, json, headers):
            request = httpx.Request("POST", url)
            assert json["model"] == "test-model"
            assert headers == {}
            return httpx.Response(
                200,
                json={
                    "id": "completion-1",
                    "choices": [{"message": {"role": "assistant", "content": "{}"}}],
                    "usage": {"prompt_tokens": 20, "completion_tokens": 5},
                },
                request=request,
            )

    monkeypatch.setattr("dagent.api.v1.model_proxy.httpx.AsyncClient", FakeUpstreamClient)
    response = await client.post(
        "/api/v1/model-proxy/v1/chat/completions",
        json={
            "model": "ignored-by-gateway",
            "messages": [
                {"role": "user", "content": f"[DAGENT_CONTEXT task_id={task_id}] clarify"}
            ],
            "max_tokens": 100,
        },
        headers={"Authorization": "Bearer test-agent-token", "X-Request-Id": "proxy-request-1"},
    )
    assert response.status_code == 200
    assert response.json()["usage"]["completion_tokens"] == 5

    logs = payload(
        await client.get(
            f"/api/v1/model-call-logs?task_id={task_id}",
            headers=users["admin"]["headers"],
        )
    )
    proxy_log = next(item for item in logs["items"] if item["request_id"] == "proxy-request-1")
    assert proxy_log["status"] == "succeeded"
    assert proxy_log["input_tokens"] == 20
    assert proxy_log["output_tokens"] == 5
