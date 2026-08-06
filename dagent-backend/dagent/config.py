from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "dagent"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./dagent.db"
    AUTO_CREATE_SCHEMA: bool = True
    SEED_DEMO_DATA: bool = True

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    QUICK_LOGIN_ENABLED: bool = False

    # Internal service authentication
    AGENT_CALLBACK_TOKEN: str = "change-me-agent-callback-token"

    # OpenCode execution plane
    AGENT_RUNTIME_ENABLED: bool = False
    REQUIREMENT_OPENCODE_SERVER_URL: str = "http://dagent-requirement-agent:4096"
    DEVELOPMENT_OPENCODE_SERVER_URL: str = "http://dagent-development-agent:4096"
    OPENCODE_SERVER_USERNAME: str = "opencode"
    OPENCODE_SERVER_PASSWORD: str = ""
    WORKSPACE_MANAGER_URL: str = "http://dagent-development-agent:8090"
    GIT_CREDENTIAL_ENCRYPTION_KEY: str = ""
    AGENT_POLL_INTERVAL_SECONDS: float = 2.0
    AGENT_RUNTIME_WORKERS: int = 2
    AGENT_TASK_TIMEOUT_SECONDS: int = 3600
    AGENT_INTERNAL_API_URL: str = "http://127.0.0.1:8000/api/v1"
    AGENT_WORKSPACE_ROOT: str = "/workspaces"

    # LLM
    LLM_API_BASE_URL: str = ""
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "deepseek-chat"

    # Integrations
    TEAM_API_BASE_URL: str = ""
    TEAM_API_TOKEN: str = ""
    GITEE_API_BASE_URL: str = "https://gitee.com/api/v5"
    GITEE_CLIENT_ID: str = ""
    GITEE_CLIENT_SECRET: str = ""

    # Browser access
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

@lru_cache
def get_settings() -> Settings:
    return Settings()
