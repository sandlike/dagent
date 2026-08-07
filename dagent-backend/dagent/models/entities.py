from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from dagent.models.base import Base, TimestampMixin
from dagent.pipeline.state_machine import PipelineState, RunStatus


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="active")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    username: Mapped[str] = mapped_column(String(80), unique=True)
    email: Mapped[str] = mapped_column(String(255), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    roles: Mapped[list[str]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="active")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="active")
    version: Mapped[int] = mapped_column(Integer, default=1)


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(30), default="member")


class Repository(Base, TimestampMixin):
    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    provider: Mapped[str] = mapped_column(String(40), default="git")
    url: Mapped[str] = mapped_column(String(500))
    default_branch: Mapped[str] = mapped_column(String(160), default="main")
    credential_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    credential_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    credential_ciphertext: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="unverified")
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ProjectRepository(Base):
    __tablename__ = "project_repositories"
    __table_args__ = (UniqueConstraint("project_id", "repository_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id", ondelete="CASCADE"), index=True)


class Requirement(Base, TimestampMixin):
    __tablename__ = "requirements"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(10), default="P2")
    stage: Mapped[str] = mapped_column(String(80), default=PipelineState.REQUIREMENT_DRAFT.value)
    run_status: Mapped[str] = mapped_column(String(30), default=RunStatus.IDLE.value)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    requirement_agent_version_id: Mapped[int | None] = mapped_column(ForeignKey("agent_versions.id"), nullable=True)
    development_document_agent_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("agent_versions.id"), nullable=True
    )
    development_agent_version_id: Mapped[int | None] = mapped_column(ForeignKey("agent_versions.id"), nullable=True)
    testing_agent_version_id: Mapped[int | None] = mapped_column(ForeignKey("agent_versions.id"), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    workspace_retention_policy: Mapped[str] = mapped_column(String(20), default="retain")
    create_idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)


class RequirementRepository(Base):
    __tablename__ = "requirement_repositories"
    __table_args__ = (UniqueConstraint("requirement_id", "repository_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"), index=True)


class RequirementWorkspace(Base, TimestampMixin):
    __tablename__ = "requirement_workspaces"
    __table_args__ = (UniqueConstraint("requirement_id", "repository_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    repository_id: Mapped[int] = mapped_column(ForeignKey("repositories.id"), index=True)
    path: Mapped[str] = mapped_column(String(500))
    base_branch: Mapped[str] = mapped_column(String(160))
    branch_name: Mapped[str] = mapped_column(String(200))
    baseline_commit: Mapped[str] = mapped_column(String(64), default="")
    head_commit: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(30), default="preparing")
    changed_files: Mapped[list[str]] = mapped_column(JSON, default=list)
    pull_request_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_error: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)


class MergeQueueEntry(Base, TimestampMixin):
    __tablename__ = "merge_queue_entries"
    __table_args__ = (UniqueConstraint("tenant_id", "idempotency_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("requirement_workspaces.id", ondelete="CASCADE"), index=True)
    target_branch: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(30), default="queued")
    conflict_files: Mapped[list[str]] = mapped_column(JSON, default=list)
    error_message: Mapped[str] = mapped_column(Text, default="")
    idempotency_key: Mapped[str] = mapped_column(String(128))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Pipeline(Base, TimestampMixin):
    __tablename__ = "pipelines"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id"), unique=True)
    current_stage: Mapped[str] = mapped_column(String(80), default=PipelineState.REQUIREMENT_DRAFT.value)
    run_status: Mapped[str] = mapped_column(String(30), default=RunStatus.IDLE.value)


class StageHistory(Base):
    __tablename__ = "stage_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    pipeline_id: Mapped[int] = mapped_column(ForeignKey("pipelines.id", ondelete="CASCADE"), index=True)
    from_stage: Mapped[str] = mapped_column(String(80))
    to_stage: Mapped[str] = mapped_column(String(80))
    trigger: Mapped[str] = mapped_column(String(80))
    operator_type: Mapped[str] = mapped_column(String(30))
    operator_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reason: Mapped[str] = mapped_column(Text, default="")
    artifact_versions: Mapped[dict[str, int]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClarificationRound(Base, TimestampMixin):
    __tablename__ = "clarification_rounds"
    __table_args__ = (UniqueConstraint("requirement_id", "round_no"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    round_no: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30), default="pending_answers")


class ClarificationQuestion(Base):
    __tablename__ = "clarification_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("clarification_rounds.id", ondelete="CASCADE"), index=True)
    question: Mapped[str] = mapped_column(Text)
    question_type: Mapped[str] = mapped_column(String(20))
    required: Mapped[bool] = mapped_column(Boolean, default=True)
    options: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    ai_recommendation: Mapped[str] = mapped_column(Text, default="")


class ClarificationAnswer(Base):
    __tablename__ = "clarification_answers"
    __table_args__ = (UniqueConstraint("question_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("clarification_questions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    answer: Mapped[Any] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Artifact(Base, TimestampMixin):
    __tablename__ = "artifacts"
    __table_args__ = (UniqueConstraint("requirement_id", "artifact_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    artifact_type: Mapped[str] = mapped_column(String(60))
    current_version: Mapped[int] = mapped_column(Integer, default=0)


class ArtifactVersion(Base):
    __tablename__ = "artifact_versions"
    __table_args__ = (UniqueConstraint("artifact_id", "version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    artifact_id: Mapped[int] = mapped_column(ForeignKey("artifacts.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    content: Mapped[Any] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(30))
    source_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)
    checksum: Mapped[str] = mapped_column(String(64))
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    gate: Mapped[str] = mapped_column(String(50))
    action: Mapped[str] = mapped_column(String(30))
    artifact_version: Mapped[int] = mapped_column(Integer)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    comment: Mapped[str] = mapped_column(Text, default="")
    from_stage: Mapped[str] = mapped_column(String(80))
    to_stage: Mapped[str] = mapped_column(String(80))
    resource_version: Mapped[int] = mapped_column(Integer)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AgentDefinition(Base, TimestampMixin):
    __tablename__ = "agent_definitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    role_type: Mapped[str] = mapped_column(String(50))
    name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="active")
    default_flag: Mapped[bool] = mapped_column(Boolean, default=False)


class AgentVersion(Base, TimestampMixin):
    __tablename__ = "agent_versions"
    __table_args__ = (UniqueConstraint("agent_id", "version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agent_definitions.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    style: Mapped[str] = mapped_column(String(50), default="balanced")
    prompt_ref: Mapped[str] = mapped_column(String(255))
    skill_policy: Mapped[list[str]] = mapped_column(JSON, default=list)
    mcp_policy: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    tool_policy: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="published")


class AgentSession(Base, TimestampMixin):
    __tablename__ = "agent_sessions"
    __table_args__ = (
        Index("ix_agent_sessions_requirement_role_status", "requirement_id", "role_type", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    role_type: Mapped[str] = mapped_column(String(50))
    opencode_session_id: Mapped[str] = mapped_column(String(160), default="")
    agent_version_id: Mapped[int] = mapped_column(ForeignKey("agent_versions.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="active")
    previous_session_id: Mapped[int | None] = mapped_column(
        ForeignKey("agent_sessions.id", ondelete="SET NULL"), nullable=True
    )


class AgentTask(Base, TimestampMixin):
    __tablename__ = "agent_tasks"
    __table_args__ = (UniqueConstraint("tenant_id", "idempotency_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[int | None] = mapped_column(
        ForeignKey("agent_sessions.id", ondelete="SET NULL"), index=True, nullable=True
    )
    parent_task_id: Mapped[int | None] = mapped_column(ForeignKey("agent_tasks.id"), nullable=True)
    stage: Mapped[str] = mapped_column(String(80))
    task_type: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(30), default="queued")
    agent_version_id: Mapped[int | None] = mapped_column(ForeignKey("agent_versions.id"), nullable=True)
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128))
    checkpoint: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    input_summary: Mapped[str] = mapped_column(Text, default="")
    output_summary: Mapped[str] = mapped_column(Text, default="")
    error_message: Mapped[str] = mapped_column(Text, default="")
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AgentTaskLog(Base):
    __tablename__ = "agent_task_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("agent_tasks.id", ondelete="CASCADE"), index=True)
    level: Mapped[str] = mapped_column(String(20), default="info")
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ModelRoute(Base, TimestampMixin):
    __tablename__ = "model_routes"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name"),
        CheckConstraint("priority > 0", name="ck_model_route_priority_positive"),
        CheckConstraint("quota_limit > 0", name="ck_model_route_quota_positive"),
        CheckConstraint("quota_reserved >= 0", name="ck_model_route_reserved_nonnegative"),
        CheckConstraint("quota_used >= 0", name="ck_model_route_used_nonnegative"),
        Index("ix_model_routes_selection", "tenant_id", "status", "health_status", "priority"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    owner_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    provider: Mapped[str] = mapped_column(String(50))
    model: Mapped[str] = mapped_column(String(160))
    base_url: Mapped[str] = mapped_column(String(500))
    api_protocol: Mapped[str] = mapped_column(String(30), default="auto")
    detected_api_protocol: Mapped[str | None] = mapped_column(String(30), nullable=True)
    priority: Mapped[int] = mapped_column(Integer)
    quota_limit: Mapped[int] = mapped_column(BigInteger, default=50_000)
    quota_reserved: Mapped[int] = mapped_column(BigInteger, default=0)
    quota_used: Mapped[int] = mapped_column(BigInteger, default=0)
    reset_policy: Mapped[str] = mapped_column(String(20), default="manual")
    timeout_ms: Mapped[int] = mapped_column(Integer, default=300_000)
    max_retries: Mapped[int] = mapped_column(Integer, default=1)
    fallback_on: Mapped[list[str]] = mapped_column(JSON, default=list)
    agent_types: Mapped[list[str]] = mapped_column(JSON, default=list)
    project_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    environments: Mapped[list[str]] = mapped_column(JSON, default=list)
    credential_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    credential_ciphertext: Mapped[str | None] = mapped_column(Text, nullable=True)
    gateway_provider_ref: Mapped[str | None] = mapped_column(String(160), nullable=True)
    gateway_route_ref: Mapped[str | None] = mapped_column(String(160), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="disabled")
    health_status: Mapped[str] = mapped_column(String(20), default="unknown")
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_called_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)


class UserModelQuota(Base, TimestampMixin):
    __tablename__ = "user_model_quotas"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id"),
        CheckConstraint("quota_limit > 0", name="ck_user_model_quota_positive"),
        CheckConstraint("quota_reserved >= 0", name="ck_user_model_quota_reserved_nonnegative"),
        CheckConstraint("quota_used >= 0", name="ck_user_model_quota_used_nonnegative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    quota_limit: Mapped[int] = mapped_column(BigInteger, default=50_000)
    quota_reserved: Mapped[int] = mapped_column(BigInteger, default=0)
    quota_used: Mapped[int] = mapped_column(BigInteger, default=0)
    reset_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    hard_limit_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_fallback: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)


class UserModelRoute(Base, TimestampMixin):
    __tablename__ = "user_model_routes"
    __table_args__ = (
        UniqueConstraint("user_id", "name"),
        CheckConstraint("priority > 0", name="ck_user_model_route_priority_positive"),
        CheckConstraint("quota_limit > 0", name="ck_user_model_route_quota_positive"),
        CheckConstraint("quota_reserved >= 0", name="ck_user_model_route_reserved_nonnegative"),
        CheckConstraint("quota_used >= 0", name="ck_user_model_route_used_nonnegative"),
        Index("ix_user_model_routes_selection", "tenant_id", "user_id", "status", "priority"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    model_route_id: Mapped[int] = mapped_column(ForeignKey("model_routes.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    level: Mapped[str] = mapped_column(String(30), default="standard")
    priority: Mapped[int] = mapped_column(Integer, default=1)
    quota_limit: Mapped[int] = mapped_column(BigInteger, default=50_000)
    quota_reserved: Mapped[int] = mapped_column(BigInteger, default=0)
    quota_used: Mapped[int] = mapped_column(BigInteger, default=0)
    status: Mapped[str] = mapped_column(String(20), default="active")
    version: Mapped[int] = mapped_column(Integer, default=1)


class UserAgentModelBinding(Base, TimestampMixin):
    __tablename__ = "user_agent_model_bindings"
    __table_args__ = (UniqueConstraint("tenant_id", "user_id", "agent_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    agent_type: Mapped[str] = mapped_column(String(50))
    route_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(Integer, default=1)


class ProjectModelRoute(Base, TimestampMixin):
    __tablename__ = "project_model_routes"
    __table_args__ = (UniqueConstraint("project_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    route_id: Mapped[int | None] = mapped_column(ForeignKey("model_routes.id"), nullable=True, index=True)
    updated_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)


class ModelQuotaLedger(Base):
    __tablename__ = "model_quota_ledger"
    __table_args__ = (
        UniqueConstraint("tenant_id", "request_id", "attempt_no"),
        Index("ix_model_quota_request", "tenant_id", "request_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    user_route_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_model_routes.id"), nullable=True, index=True
    )
    route_id: Mapped[int] = mapped_column(ForeignKey("model_routes.id"), index=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True)
    request_id: Mapped[str] = mapped_column(String(128))
    attempt_no: Mapped[int] = mapped_column(Integer, default=1)
    reserved_tokens: Mapped[int] = mapped_column(BigInteger)
    input_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    output_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    released_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    status: Mapped[str] = mapped_column(String(20), default="reserved")
    usage_estimated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ModelCallLog(Base):
    __tablename__ = "model_call_logs"
    __table_args__ = (
        UniqueConstraint("tenant_id", "request_id", "attempt_no"),
        Index("ix_model_call_logs_filters", "tenant_id", "route_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    user_route_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_model_routes.id"), nullable=True, index=True
    )
    agent_type: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("model_routes.id"), index=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    requirement_id: Mapped[int | None] = mapped_column(
        ForeignKey("requirements.id", ondelete="SET NULL"), nullable=True
    )
    request_id: Mapped[str] = mapped_column(String(128))
    trace_id: Mapped[str] = mapped_column(String(64), index=True)
    attempt_no: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20))
    error_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    input_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    output_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    estimated_input_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    output_token_budget: Mapped[int] = mapped_column(BigInteger, default=0)
    reserved_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    released_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    usage_estimated: Mapped[bool] = mapped_column(Boolean, default=False)
    fallback_from_route_id: Mapped[int | None] = mapped_column(ForeignKey("model_routes.id"), nullable=True)
    fallback_from_user_route_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_model_routes.id"), nullable=True
    )
    fallback_reason: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    actor_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actor_type: Mapped[str] = mapped_column(String(30), default="user")
    action: Mapped[str] = mapped_column(String(100))
    resource_type: Mapped[str] = mapped_column(String(50))
    resource_id: Mapped[str] = mapped_column(String(80))
    result: Mapped[str] = mapped_column(String(30), default="success")
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    trace_id: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
