from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

NonEmptyString = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ArtifactContent(BaseModel):
    model_config = ConfigDict(extra="allow")

    schema_version: Literal[1] = 1
    summary: str = ""


class ClarificationAnswerContent(BaseModel):
    model_config = ConfigDict(extra="allow")

    question_id: int | None = None
    round_no: int | None = None
    question: str = ""
    answer: Any = None
    answer_value: Any = None
    answer_labels: list[str] = Field(default_factory=list)


class RequirementDocumentContent(ArtifactContent):
    title: str = ""
    description: str = ""
    priority: str = ""
    repository_ids: list[int] = Field(default_factory=list)
    clarification_summary: str = ""
    confirmed_answers: list[ClarificationAnswerContent] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)


class ModuleChange(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str = ""
    path: str = ""
    change: str = ""


class ApiChange(BaseModel):
    model_config = ConfigDict(extra="allow")

    method: str = ""
    path: str = ""
    description: str = ""


class RiskItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    risk: str = ""
    mitigation: str = ""


class ChecklistItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    item: str = ""
    status: str = "pending"


class DevelopmentDocumentContent(ArtifactContent):
    goals: list[str] = Field(default_factory=list)
    non_goals: list[str] = Field(default_factory=list)
    impacted_modules: list[ModuleChange] = Field(default_factory=list)
    frontend_changes: list[str] = Field(default_factory=list)
    backend_changes: list[str] = Field(default_factory=list)
    agent_changes: list[str] = Field(default_factory=list)
    data_changes: list[str] = Field(default_factory=list)
    api_changes: list[ApiChange] = Field(default_factory=list)
    implementation_steps: list[str] = Field(default_factory=list)
    risks: list[RiskItem] = Field(default_factory=list)
    rollback_plan: list[str] = Field(default_factory=list)
    test_strategy: list[str] = Field(default_factory=list)
    acceptance_checklist: list[ChecklistItem] = Field(default_factory=list)


class ChangedFile(BaseModel):
    model_config = ConfigDict(extra="allow")

    path: str = ""
    change: str = ""


class RequirementMapping(BaseModel):
    model_config = ConfigDict(extra="allow")

    requirement: str = ""
    implementation: str = ""


class CheckResult(BaseModel):
    model_config = ConfigDict(extra="allow")

    check_type: str = ""
    command: str = ""
    status: str = ""
    summary: str = ""
    exit_code: int | None = None


class GitCommit(BaseModel):
    model_config = ConfigDict(extra="allow")

    workspace_id: int | None = None
    commit: str = ""
    head_commit: str = ""
    message: str = ""
    changed_files: list[str] = Field(default_factory=list)


class DevelopmentReportContent(ArtifactContent):
    tests_passed: bool | None = None
    changed_files: list[ChangedFile] = Field(default_factory=list)
    requirement_mapping: list[RequirementMapping] = Field(default_factory=list)
    checks: list[CheckResult] = Field(default_factory=list)
    incomplete_items: list[str] = Field(default_factory=list)
    residual_risks: list[str] = Field(default_factory=list)
    manual_actions: list[str] = Field(default_factory=list)
    git_commits: list[GitCommit] = Field(default_factory=list)
    implementation_checklist: list[ChecklistItem] = Field(default_factory=list)


class TestCaseContent(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = ""
    title: str = ""
    requirement: str = ""
    preconditions: list[str] = Field(default_factory=list)
    steps: list[str] = Field(default_factory=list)
    expected_result: str = ""
    type: str = ""
    priority: str = ""
    automated: bool = False
    required: bool = True
    repository_id: int | None = None
    working_directory: str = "."
    command: list[str] = Field(default_factory=list)
    timeout_seconds: int = Field(default=300, ge=1, le=3600)


class TestCasesContent(ArtifactContent):
    cases: list[TestCaseContent] = Field(default_factory=list)


class ManualTestCaseContent(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: NonEmptyString
    title: NonEmptyString
    preconditions: list[NonEmptyString] = Field(min_length=1)
    steps: list[NonEmptyString] = Field(min_length=1)
    expected_result: NonEmptyString
    priority: NonEmptyString
    automated: Literal[False]


class TestPlanContent(ArtifactContent):
    test_scope: list[NonEmptyString] = Field(min_length=1)
    test_environment: list[NonEmptyString] = Field(min_length=1)
    preconditions: list[NonEmptyString] = Field(min_length=1)
    risk_points: list[NonEmptyString] = Field(min_length=1)
    entry_criteria: list[NonEmptyString] = Field(min_length=1)
    exit_criteria: list[NonEmptyString] = Field(min_length=1)
    manual_test_cases: list[ManualTestCaseContent] = Field(min_length=1)


class TestTotals(BaseModel):
    passed: int = Field(default=0, ge=0)
    failed: int = Field(default=0, ge=0)
    skipped: int = Field(default=0, ge=0)
    blocked: int = Field(default=0, ge=0)


class TestExecutionItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    case_id: str = ""
    status: str = ""
    duration_ms: int | None = None
    evidence: str = ""


class TestCommand(BaseModel):
    model_config = ConfigDict(extra="allow")

    command: str = ""
    started_at: str = ""
    finished_at: str = ""
    exit_code: int | None = None
    evidence: str = ""


class TestReportContent(ArtifactContent):
    status: Literal["passed", "failed", "unable_to_test"] = "unable_to_test"
    tested_commit: str = ""
    summary: str = ""
    scenarios: list[TestCaseContent] = Field(default_factory=list)
    totals: TestTotals = Field(default_factory=TestTotals)
    executions: list[TestExecutionItem] = Field(default_factory=list)
    commands: list[TestCommand] = Field(default_factory=list)
    failures: list[str] = Field(default_factory=list)
    log_summary: str = ""
    all_required_passed: bool | None = None


class AcceptanceRecordContent(ArtifactContent):
    accepted: bool = False
    comment: str = ""
    artifact_versions: dict[str, int] = Field(default_factory=dict)
    reviewer_id: int | None = None


ARTIFACT_MODELS: dict[str, type[ArtifactContent]] = {
    "requirement_document": RequirementDocumentContent,
    "development_document": DevelopmentDocumentContent,
    "development_report": DevelopmentReportContent,
    "test_cases": TestCasesContent,
    "test_plan": TestPlanContent,
    "test_report": TestReportContent,
    "acceptance_record": AcceptanceRecordContent,
}

TASK_ARTIFACT_TYPES = {
    "development_document_generation": "development_document",
    "development": "development_report",
    "failure_fix": "development_report",
    "test_plan_generation": "test_plan",
}


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    values = value if isinstance(value, list) else [value]
    return [str(item) for item in values if item is not None and str(item).strip()]


def _object_list(value: Any, text_key: str) -> list[dict[str, Any]]:
    if value is None:
        return []
    values = value if isinstance(value, list) else [value]
    result: list[dict[str, Any]] = []
    for item in values:
        if isinstance(item, dict):
            result.append(dict(item))
        elif item is not None:
            result.append({text_key: str(item)})
    return result


def _base_payload(content: Any) -> dict[str, Any]:
    if isinstance(content, dict):
        return dict(content)
    if content is None:
        return {}
    return {"summary": str(content)}


def _normalize_requirement_document(payload: dict[str, Any]) -> None:
    payload["repository_ids"] = [int(item) for item in payload.get("repository_ids") or []]
    payload["acceptance_criteria"] = _string_list(payload.get("acceptance_criteria"))
    payload["confirmed_answers"] = _object_list(payload.get("confirmed_answers"), "answer")


def _normalize_development_document(payload: dict[str, Any]) -> None:
    for key in (
        "non_goals",
        "frontend_changes",
        "backend_changes",
        "agent_changes",
        "data_changes",
        "implementation_steps",
    ):
        payload[key] = _string_list(payload.get(key))
    payload["goals"] = _string_list(payload.get("goals") or payload.get("scope"))
    payload["rollback_plan"] = _string_list(payload.get("rollback_plan") or payload.get("rollback"))
    payload["test_strategy"] = _string_list(payload.get("test_strategy") or payload.get("tests"))
    payload["impacted_modules"] = _object_list(payload.get("impacted_modules") or payload.get("modules"), "name")
    payload["api_changes"] = _object_list(payload.get("api_changes"), "description")
    payload["risks"] = _object_list(payload.get("risks"), "risk")
    payload["acceptance_checklist"] = _object_list(
        payload.get("acceptance_checklist") or payload.get("acceptance"), "item"
    )


def _normalize_development_report(payload: dict[str, Any]) -> None:
    payload["changed_files"] = _object_list(payload.get("changed_files") or payload.get("files"), "path")
    payload["requirement_mapping"] = _object_list(payload.get("requirement_mapping"), "requirement")
    payload["checks"] = _object_list(payload.get("checks") or payload.get("tests"), "summary")
    for key in ("incomplete_items", "residual_risks", "manual_actions"):
        payload[key] = _string_list(payload.get(key))
    payload["git_commits"] = _object_list(payload.get("git_commits") or payload.get("commits"), "commit")
    payload["implementation_checklist"] = _object_list(
        payload.get("implementation_checklist") or payload.get("checklist"), "item"
    )


def _normalize_test_cases(payload: dict[str, Any]) -> None:
    legacy_cases = payload.pop("test_cases", None)
    cases = _object_list(payload.get("cases") or legacy_cases, "title")
    for index, case in enumerate(cases, start=1):
        case.setdefault("id", f"TC-{index:03d}")
        case.setdefault("title", str(case.get("requirement") or case["id"]))
        case["preconditions"] = _string_list(case.get("preconditions"))
        case["steps"] = _string_list(case.get("steps"))
        case.setdefault("expected_result", str(case.get("expected") or ""))
        case.setdefault("automated", bool(case.get("automation") or False))
        case.setdefault("required", True)
        case["command"] = _string_list(case.get("command") or case.get("argv"))
    payload["cases"] = cases


def _normalize_test_plan(payload: dict[str, Any]) -> None:
    for key in (
        "test_scope",
        "test_environment",
        "preconditions",
        "risk_points",
        "entry_criteria",
        "exit_criteria",
    ):
        payload[key] = _string_list(payload.get(key))
    cases = _object_list(payload.get("manual_test_cases"), "title")
    for case in cases:
        case["preconditions"] = _string_list(case.get("preconditions"))
        case["steps"] = _string_list(case.get("steps"))
    payload["manual_test_cases"] = cases


def _normalize_test_report(payload: dict[str, Any]) -> None:
    legacy_result = str(payload.pop("result_type", "") or "")
    if "status" not in payload:
        if legacy_result == "passed" or payload.get("all_required_passed") is True:
            payload["status"] = "passed"
        elif legacy_result == "code_failure":
            payload["status"] = "failed"
        else:
            payload["status"] = "unable_to_test"
    payload.setdefault("summary", str(payload.get("log_summary") or ""))
    payload.setdefault("tested_commit", "")
    payload.setdefault("scenarios", payload.pop("cases", []))
    commands = payload.get("commands")
    if isinstance(commands, list):
        for command in commands:
            if isinstance(command, dict):
                command.setdefault("evidence", str(command.pop("summary", "") or ""))
    totals = payload.get("totals")
    if not isinstance(totals, dict):
        totals = {
            "passed": payload.get("passed", 0),
            "failed": payload.get("failed", 0),
            "skipped": payload.get("skipped", 0),
            "blocked": payload.get("blocked", 0),
        }
    payload["totals"] = totals
    payload["executions"] = _object_list(payload.get("executions") or payload.get("results"), "case_id")
    payload["commands"] = _object_list(payload.get("commands"), "command")
    payload["failures"] = _string_list(payload.get("failures"))


def normalize_artifact_content(artifact_type: str, content: Any) -> Any:
    model = ARTIFACT_MODELS.get(artifact_type)
    if model is None:
        return content
    payload = _base_payload(content)
    payload["schema_version"] = 1
    normalizers = {
        "requirement_document": _normalize_requirement_document,
        "development_document": _normalize_development_document,
        "development_report": _normalize_development_report,
        "test_cases": _normalize_test_cases,
        "test_plan": _normalize_test_plan,
        "test_report": _normalize_test_report,
    }
    normalizer = normalizers.get(artifact_type)
    if normalizer is not None:
        normalizer(payload)
    return model.model_validate(payload).model_dump(mode="json", exclude_none=True)


def artifact_schema_for_task(task_type: str) -> dict[str, Any]:
    artifact_type = TASK_ARTIFACT_TYPES[task_type]
    return ARTIFACT_MODELS[artifact_type].model_json_schema()


def format_validation_error(exc: ValidationError) -> str:
    details = []
    for error in exc.errors(include_url=False, include_input=False):
        path = ".".join(str(part) for part in error.get("loc", ())) or "artifact_content"
        details.append(f"{path}: {error.get('msg', 'invalid value')}")
    return "; ".join(details)


def reconcile_development_report(content: dict[str, Any]) -> dict[str, Any]:
    raw_checks = content.get("checks")
    checks = [item for item in raw_checks if isinstance(item, dict)] if isinstance(raw_checks, list) else []
    for check in checks:
        raw_type = str(
            check.get("check_type")
            or check.get("type")
            or check.get("name")
            or check.get("title")
            or ""
        )
        searchable = " ".join(
            str(check.get(field) or "")
            for field in ("check_type", "type", "name", "title", "command", "summary")
        ).lower()
        normalized_type = raw_type.strip().lower().replace("-", "_").replace(" ", "_")
        if normalized_type in {"unit", "unit_tests", "unittest", "pytest"} or any(
            marker in searchable for marker in ("unit test", "unit_test", "pytest", "unittest", "单元")
        ):
            check["check_type"] = "unit_test"
        elif normalized_type in {"smoke", "smoke_tests", "health_check"} or any(
            marker in searchable for marker in ("smoke", "health check", "health_check", "冒烟")
        ):
            check["check_type"] = "smoke_test"

    content["checks"] = checks
    return content


def validate_development_report(content: dict[str, Any]) -> None:
    errors: list[str] = []
    changed_files = content.get("changed_files")
    if not isinstance(changed_files, list) or not any(
        isinstance(item, dict) and str(item.get("path") or "").strip() for item in changed_files
    ):
        errors.append("changed_files must contain at least one modified file")
    if content.get("tests_passed") is not True:
        errors.append("tests_passed must be true")
    checks = content.get("checks")
    check_items = checks if isinstance(checks, list) else []
    for required_type in ("unit_test", "smoke_test"):
        matching = next(
            (
                item
                for item in check_items
                if isinstance(item, dict) and str(item.get("check_type") or "") == required_type
            ),
            None,
        )
        if matching is None:
            errors.append(f"checks must contain a {required_type} entry")
            continue
        for field in ("command", "status", "summary"):
            if not str(matching.get(field) or "").strip():
                errors.append(f"checks.{required_type}.{field} must be non-empty")
        if matching.get("exit_code") != 0:
            errors.append(f"checks.{required_type}.exit_code must be 0")
    if errors:
        raise ValueError("Development report validation failed: " + "; ".join(errors))
