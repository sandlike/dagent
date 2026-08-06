from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, SecretStr, computed_field, field_validator

from dagent.api.schemas.common import ORMModel

RoleCode = Literal["admin", "pm", "developer", "qa"]
PriorityCode = Literal["P0", "P1", "P2", "P3"]
ReviewGate = Literal["development_document", "development_report", "test_plan", "final_acceptance"]


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=256)


class UserRead(ORMModel):
    id: int
    username: str
    email: str
    roles: list[RoleCode]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def role(self) -> RoleCode:
        return self.roles[0]


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserRead


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=5000)
    member_ids: list[int] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    member_ids: list[int] | None = None
    resource_version: int = Field(ge=1)


class ProjectRead(ORMModel):
    id: int
    name: str
    description: str
    owner_id: int
    status: str
    version: int
    repository_count: int = 0
    requirement_count: int = 0
    created_at: datetime
    updated_at: datetime


class RepositoryBind(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    provider: str = Field(default="git", min_length=1, max_length=40)
    url: str = Field(min_length=1, max_length=500)
    default_branch: str = Field(default="main", min_length=1, max_length=160)

    @field_validator("url")
    @classmethod
    def validate_git_url(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("Repository URL must use HTTPS")
        return value


class RepositoryRead(ORMModel):
    id: int
    name: str
    provider: str
    url: str
    default_branch: str
    status: str
    credential_configured: bool = False
    last_verified_at: datetime | None
    created_at: datetime


class RepositoryCredentialRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    token: SecretStr = Field(min_length=1, max_length=4096)


RepositoryVerificationResult = Literal[
    "read_success",
    "read_write_success",
    "token_invalid",
    "no_write_permission",
    "read_failed",
]


class RepositoryVerificationRead(BaseModel):
    repository: RepositoryRead
    result: RepositoryVerificationResult
    read_verified: bool
    write_verified: bool
    credential_configured: bool
    message: str


class RequirementCreate(BaseModel):
    project_id: int
    title: str = Field(min_length=1, max_length=240)
    description: str = Field(default="", max_length=100_000)
    priority: PriorityCode = "P2"
    repository_ids: list[int] = Field(default_factory=list)
    requirement_agent_version_id: int | None = None
    development_agent_version_id: int | None = None


class RequirementUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=100_000)
    priority: PriorityCode | None = None
    repository_ids: list[int] | None = None
    requirement_agent_version_id: int | None = None
    development_agent_version_id: int | None = None
    resource_version: int = Field(ge=1)


class RequirementRead(ORMModel):
    id: int
    project_id: int
    title: str
    description: str
    priority: PriorityCode
    stage: str
    run_status: str
    version: int
    created_by: int
    assignee_id: int | None
    requirement_agent_version_id: int | None
    development_agent_version_id: int | None
    repository_ids: list[int] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None


class ResourceVersionRequest(BaseModel):
    resource_version: int = Field(ge=1)


class CancelRequest(ResourceVersionRequest):
    reason: str = Field(min_length=1, max_length=5000)
    confirmed: bool


class PipelineRead(BaseModel):
    requirement_id: int
    current_stage: str
    run_status: str
    resource_version: int
    history: list[dict[str, Any]]


class ClarificationAnswerItem(BaseModel):
    question_id: int
    answer: Any


class ClarificationAnswersRequest(BaseModel):
    answers: list[ClarificationAnswerItem] = Field(min_length=1)
    resource_version: int = Field(ge=1)


class ClarificationConfirmRequest(BaseModel):
    resource_version: int = Field(ge=1)
    requirement_document: Any


class ArtifactReviseRequest(BaseModel):
    resource_version: int = Field(ge=1)
    content: Any
    comment: str = Field(default="", max_length=5000)


class ReviewRequest(BaseModel):
    action: Literal["approve", "reject", "transfer"]
    comment: str = Field(default="", max_length=5000)
    artifact_version: int = Field(ge=1)
    assignee_id: int | None = None
    resource_version: int = Field(ge=1)
    final_confirmation: bool = False


class TaskCreateRequest(BaseModel):
    task_type: str | None = Field(default=None, max_length=80)
    input_summary: str = Field(default="", max_length=5000)


class ClarificationQuestionResult(BaseModel):
    question: str = ""
    question_type: str = "text"
    required: bool = True
    options: list[dict[str, Any]] = Field(default_factory=list)
    ai_recommendation: str = ""


class TaskResultRequest(BaseModel):
    status: Literal["succeeded", "failed"]
    output_summary: str = Field(default="", max_length=100_000)
    error_message: str = Field(default="", max_length=20_000)
    checkpoint: dict[str, Any] = Field(default_factory=dict)
    artifact_type: str | None = Field(default=None, max_length=60)
    artifact_content: Any = None
    test_cases: Any = None
    clarification_questions: Any = None
    logs: list[str] = Field(default_factory=list, max_length=1000)


class AgentSessionRead(ORMModel):
    id: int
    requirement_id: int
    role_type: str
    opencode_session_id: str
    agent_version_id: int
    status: str
    previous_session_id: int | None
    created_at: datetime
    updated_at: datetime


class AgentTaskRead(ORMModel):
    id: int
    requirement_id: int
    session_id: int | None
    parent_task_id: int | None
    stage: str
    task_type: str
    status: str
    agent_version_id: int | None
    idempotency_key: str
    checkpoint: dict[str, Any]
    input_summary: str
    output_summary: str
    error_message: str
    retry_count: int
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
