from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from dagent.api.schemas.common import ORMModel


class WorkspaceRead(ORMModel):
    id: int
    requirement_id: int
    repository_id: int
    path: str
    base_branch: str
    branch_name: str
    baseline_commit: str
    head_commit: str
    status: str
    changed_files: list[str]
    pull_request_url: str | None
    last_error: str
    version: int
    created_at: datetime
    updated_at: datetime


class MergeCheckRequest(BaseModel):
    workspace_id: int = Field(gt=0)
    target_branch: str | None = Field(default=None, min_length=1, max_length=160)


class MergeCheckResult(BaseModel):
    workspace_id: int
    can_merge: bool
    target_branch: str
    conflict_files: list[str] = Field(default_factory=list)
    message: str


class MergeQueueRequest(MergeCheckRequest):
    idempotency_key: str | None = Field(default=None, max_length=128)


class MergeQueueRead(ORMModel):
    id: int
    requirement_id: int
    workspace_id: int
    target_branch: str
    status: str
    conflict_files: list[str]
    error_message: str
    idempotency_key: str
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


AgentRoleType = Literal["requirement_clarification", "development"]


class AgentDefinitionCreate(BaseModel):
    role_type: AgentRoleType
    name: str = Field(min_length=1, max_length=120)
    default_flag: bool = False


class AgentDefinitionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    default_flag: bool | None = None


class AgentVersionCreate(BaseModel):
    style: str = Field(default="balanced", min_length=1, max_length=50)
    prompt_ref: str = Field(min_length=1, max_length=255)
    skill_policy: list[str] = Field(default_factory=list)
    mcp_policy: dict[str, Any] = Field(default_factory=dict)
    tool_policy: dict[str, Any] = Field(default_factory=dict)


class AgentPublishRequest(BaseModel):
    version_id: int = Field(gt=0)


class AgentVersionRead(ORMModel):
    id: int
    version: int
    style: str
    prompt_ref: str
    skill_policy: list[str]
    mcp_policy: dict[str, Any]
    tool_policy: dict[str, Any]
    status: str
    created_at: datetime
    updated_at: datetime


class AgentDefinitionRead(ORMModel):
    id: int
    role_type: str
    name: str
    status: str
    default_flag: bool
    versions: list[AgentVersionRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class AuditLogRead(ORMModel):
    id: int
    actor_id: int | None
    actor_type: str
    action: str
    resource_type: str
    resource_id: str
    result: str
    details: dict[str, Any]
    trace_id: str
    created_at: datetime
