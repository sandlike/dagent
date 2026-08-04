"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class AgentSettings(BaseSettings):
    """Agent service settings. All values sourced from env vars."""

    # --- LLM -----------------------------------------------------------
    llm_api_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = "deepseek-chat"
    llm_temperature: float = 0.7
    llm_max_tokens: int = 4096

    # --- Qoder / OpenCode ---------------------------------------------
    qoder_api_base_url: str = ""
    qoder_api_key: str = ""

    # --- Codebase working dir -----------------------------------------
    codebase_work_dir: str = "/tmp/dagent-codebases"

    # --- Retry / timeout -----------------------------------------------
    agent_max_retries: int = 3
    agent_timeout_seconds: int = 3600  # 1 hour per PRD

    # --- Logging -------------------------------------------------------
    log_level: str = "INFO"

    model_config = {"env_prefix": "DAGENT_", "env_file": ".env", "extra": "ignore"}


settings = AgentSettings()
