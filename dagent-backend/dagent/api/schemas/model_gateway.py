from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, Field, SecretStr, computed_field, field_validator

from dagent.api.schemas.common import ORMModel

FallbackError = Literal[
    "quota_exhausted",
    "rate_limited",
    "timeout",
    "server_error",
    "authentication_error",
]
RouteStatus = Literal["active", "disabled"]
HealthStatus = Literal["unknown", "healthy", "unhealthy"]
AgentModelType = Literal["requirement_clarification", "development_document", "development"]
ModelLevel = Literal["high", "standard", "economy"]
ApiProtocol = Literal["auto", "chat_completions", "responses"]
ConfiguredApiProtocol = Literal["chat_completions", "responses"]
DetectedApiProtocol = Literal["chat_completions", "responses"]


def default_fallback_errors() -> list[FallbackError]:
    return ["quota_exhausted", "rate_limited", "timeout", "server_error", "authentication_error"]


class ModelRouteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    provider: str = Field(min_length=1, max_length=50)
    model: str = Field(min_length=1, max_length=160)
    base_url: AnyHttpUrl
    api_protocol: ConfiguredApiProtocol = "chat_completions"
    priority: int = Field(ge=1, le=1000)
    quota_limit: int = Field(default=50_000, ge=1)
    reset_policy: Literal["manual"] = "manual"
    timeout_ms: int = Field(default=300_000, ge=1_000, le=600_000)
    max_retries: int = Field(default=1, ge=0, le=5)
    fallback_on: list[FallbackError] = Field(default_factory=default_fallback_errors)
    agent_types: list[str] = Field(default_factory=list)
    project_ids: list[int] = Field(default_factory=list)
    environments: list[str] = Field(default_factory=lambda: ["test", "production"])
    credential_ref: str | None = Field(default=None, max_length=255)
    api_token: SecretStr | None = Field(default=None, min_length=1, max_length=1000)
    gateway_provider_ref: str | None = Field(default=None, max_length=160)
    gateway_route_ref: str | None = Field(default=None, max_length=160)

    @field_validator("provider", "model", "name")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

    @field_validator("agent_types", "environments")
    @classmethod
    def normalize_string_list(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(value.strip() for value in values if value.strip()))

    @field_validator("project_ids")
    @classmethod
    def normalize_project_ids(cls, values: list[int]) -> list[int]:
        if any(value <= 0 for value in values):
            raise ValueError("Project IDs must be positive")
        return list(dict.fromkeys(values))


class ModelRouteUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    provider: str | None = Field(default=None, min_length=1, max_length=50)
    model: str | None = Field(default=None, min_length=1, max_length=160)
    base_url: AnyHttpUrl | None = None
    api_protocol: ConfiguredApiProtocol | None = None
    priority: int | None = Field(default=None, ge=1, le=1000)
    quota_limit: int | None = Field(default=None, ge=1)
    timeout_ms: int | None = Field(default=None, ge=1_000, le=600_000)
    max_retries: int | None = Field(default=None, ge=0, le=5)
    fallback_on: list[FallbackError] | None = None
    agent_types: list[str] | None = None
    project_ids: list[int] | None = None
    environments: list[str] | None = None
    credential_ref: str | None = Field(default=None, max_length=255)
    api_token: SecretStr | None = Field(default=None, min_length=1, max_length=1000)
    gateway_provider_ref: str | None = Field(default=None, max_length=160)
    gateway_route_ref: str | None = Field(default=None, max_length=160)
    resource_version: int = Field(ge=1)

    @field_validator("provider", "model", "name")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value

    @field_validator("agent_types", "environments")
    @classmethod
    def normalize_optional_string_list(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        return list(dict.fromkeys(value.strip() for value in values if value.strip()))

    @field_validator("project_ids")
    @classmethod
    def normalize_optional_project_ids(cls, values: list[int] | None) -> list[int] | None:
        if values is None:
            return None
        if any(value <= 0 for value in values):
            raise ValueError("Project IDs must be positive")
        return list(dict.fromkeys(values))


class ModelRouteRead(ORMModel):
    id: int
    owner_user_id: int | None
    can_manage: bool = False
    name: str
    provider: str
    model: str
    base_url: str
    api_protocol: ApiProtocol
    detected_api_protocol: DetectedApiProtocol | None
    priority: int
    quota_limit: int
    quota_reserved: int
    quota_used: int
    reset_policy: str
    timeout_ms: int
    max_retries: int
    fallback_on: list[str]
    agent_types: list[str]
    project_ids: list[int]
    environments: list[str]
    credential_ref: str | None
    credential_ciphertext: str | None = Field(default=None, exclude=True, repr=False)
    gateway_provider_ref: str | None
    gateway_route_ref: str | None
    status: RouteStatus
    health_status: HealthStatus
    last_checked_at: datetime | None
    last_called_at: datetime | None
    version: int
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def quota_remaining(self) -> int:
        return max(0, self.quota_limit - self.quota_reserved - self.quota_used)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def credential_configured(self) -> bool:
        return bool(self.credential_ref or getattr(self, "credential_ciphertext", None))


class ModelRouteTestResult(BaseModel):
    ok: bool
    latency_ms: int
    health_status: HealthStatus
    sample_models: list[str] = Field(default_factory=list)
    response_preview: str | None = None
    detected_api_protocol: DetectedApiProtocol | None = None
    message: str


class ModelUsageItem(BaseModel):
    route_id: int
    route_name: str
    provider: str
    model: str
    quota_limit: int
    reserved_tokens: int
    input_tokens: int
    output_tokens: int
    released_tokens: int
    used_tokens: int
    remaining_tokens: int
    call_count: int


class ModelCallLogRead(ORMModel):
    id: int
    route_id: int
    task_id: int | None
    project_id: int | None
    requirement_id: int | None
    request_id: str
    trace_id: str
    attempt_no: int
    status: str
    error_type: str | None
    error_code: str | None
    latency_ms: int
    input_tokens: int
    output_tokens: int
    estimated_input_tokens: int
    output_token_budget: int
    reserved_tokens: int
    released_tokens: int
    usage_estimated: bool
    fallback_from_route_id: int | None
    fallback_reason: str | None
    created_at: datetime


class UserModelQuotaRead(BaseModel):
    quota_limit: int
    quota_reserved: int
    quota_used: int
    quota_remaining: int | None
    reset_at: datetime | None
    hard_limit_enabled: bool
    auto_fallback: bool
    resource_version: int


class AgentModelRouteRead(BaseModel):
    id: int
    name: str
    provider: str
    model: str
    api_protocol: ApiProtocol
    detected_api_protocol: DetectedApiProtocol | None
    priority: int
    agent_types: list[str]
    quota_limit: int
    quota_reserved: int
    quota_used: int
    quota_remaining: int
    call_count: int
    status: RouteStatus
    health_status: HealthStatus
    fallback_on: list[str]
    credential_configured: bool
    last_checked_at: datetime | None
    last_called_at: datetime | None
    resource_version: int


class UserAgentModelBindingUpdate(BaseModel):
    route_ids: list[int] = Field(
        min_length=1,
        description="Ordered model route IDs; list position is the per-Agent priority starting at 1",
    )
    resource_version: int = Field(ge=1)

    @field_validator("route_ids")
    @classmethod
    def unique_route_ids(cls, values: list[int]) -> list[int]:
        if any(value <= 0 for value in values):
            raise ValueError("Route IDs must be positive")
        if len(values) != len(set(values)):
            raise ValueError("An Agent model priority list cannot contain duplicate routes")
        return values


class UserAgentModelBindingRead(BaseModel):
    agent_type: AgentModelType
    route_ids: list[int] = Field(
        description="Ordered model route IDs; list position is the per-Agent priority starting at 1"
    )
    resource_version: int


class UserModelGatewaySettingsUpdate(BaseModel):
    auto_fallback: bool
    resource_version: int = Field(ge=1)


class UserModelQuotaAdminUpdate(BaseModel):
    quota_limit: int = Field(ge=1)
    hard_limit_enabled: bool | None = None
    reset_at: datetime | None = None
    resource_version: int = Field(ge=1)


class UserModelGatewayRead(BaseModel):
    quota: UserModelQuotaRead
    routes: list[AgentModelRouteRead]
    bindings: list[UserAgentModelBindingRead]


class UserModelCallLogRead(BaseModel):
    id: int
    user_id: int
    agent_type: str
    route_id: int
    route_name: str
    model: str
    task_id: int | None
    project_id: int | None
    requirement_id: int | None
    request_id: str
    trace_id: str
    attempt_no: int
    status: str
    error_type: str | None
    error_code: str | None
    latency_ms: int
    input_tokens: int
    output_tokens: int
    estimated_input_tokens: int
    output_token_budget: int
    reserved_tokens: int
    released_tokens: int
    usage_estimated: bool
    fallback_from_route_id: int | None
    fallback_reason: str | None
    created_at: datetime


class ModelReservationRequest(BaseModel):
    task_id: int = Field(gt=0)
    request_id: str = Field(min_length=1, max_length=128)
    estimated_tokens: int = Field(gt=0, le=10_000_000)
    estimated_input_tokens: int = Field(ge=0, le=10_000_000)
    output_token_budget: int = Field(ge=0, le=10_000_000)
    environment: str = Field(default="production", min_length=1, max_length=40)


class ModelFallbackRequest(BaseModel):
    task_id: int = Field(gt=0)
    attempt_no: int = Field(ge=1)
    estimated_tokens: int = Field(gt=0, le=10_000_000)
    estimated_input_tokens: int = Field(ge=0, le=10_000_000)
    output_token_budget: int = Field(ge=0, le=10_000_000)
    error_type: FallbackError
    error_code: str | None = Field(default=None, max_length=40)
    latency_ms: int = Field(default=0, ge=0)
    environment: str = Field(default="production", min_length=1, max_length=40)


class ModelSettlementRequest(BaseModel):
    task_id: int = Field(gt=0)
    attempt_no: int = Field(default=1, ge=1)
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    latency_ms: int = Field(default=0, ge=0)
    usage_estimated: bool = False


class ModelReservationRead(BaseModel):
    request_id: str
    attempt_no: int
    reserved_tokens: int
    route: ModelRouteRead


class ProjectModelRouteUpdate(BaseModel):
    route_id: int | None = Field(default=None, gt=0)
    resource_version: int = Field(ge=1)


class ProjectModelRouteRead(BaseModel):
    project_id: int
    route_id: int | None
    route_name: str | None
    resource_version: int
