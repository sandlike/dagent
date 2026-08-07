"""BaseAgent abstract class, AgentContext and AgentResult models.

Every agent in the Dagent platform inherits from BaseAgent.
The class provides:
  - A unified ``execute(context) -> AgentResult`` contract
  - Built-in retry with exponential back-off (configurable max retries)
  - Structured error capture so failures never crash the pipeline
"""

from __future__ import annotations

import asyncio
import json
import logging
import traceback
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

class CodebaseInfo(BaseModel):
    """Metadata about a code repository available to agents."""

    repository_id: int
    name: str
    git_url: str
    default_branch: str = "main"
    local_path: str = ""


class AgentContext(BaseModel):
    """Immutable context passed to every agent invocation."""

    requirement_id: int
    project_id: int
    tenant_id: int
    codebase_info: list[CodebaseInfo] = Field(default_factory=list)
    previous_artifacts: dict[str, Any] = Field(default_factory=dict)
    llm_model: str = "deepseek-chat"
    extra: dict[str, Any] = Field(default_factory=dict)


class AgentResultStatus(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    NEEDS_HUMAN = "needs_human_intervention"


class AgentResult(BaseModel):
    """Standardised return value for every agent execution."""

    status: AgentResultStatus = AgentResultStatus.SUCCESS
    output: str = ""
    artifacts: dict[str, Any] = Field(default_factory=dict)
    error_message: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def success(cls, output: str = "", **kwargs: Any) -> "AgentResult":
        return cls(status=AgentResultStatus.SUCCESS, output=output, **kwargs)

    @classmethod
    def failure(cls, error_message: str, **kwargs: Any) -> "AgentResult":
        return cls(status=AgentResultStatus.FAILURE, error_message=error_message, **kwargs)

    @classmethod
    def needs_human(cls, error_message: str = "", **kwargs: Any) -> "AgentResult":
        return cls(status=AgentResultStatus.NEEDS_HUMAN, error_message=error_message, **kwargs)


def resolve_answer_text(raw: Any, options: list[dict] | None = None) -> str:
    """Resolve a clarification answer value to a human/LLM-readable string.

    The clarification ``answer`` column is JSON: a single-choice answer is the
    option id (e.g. ``"a"``) but may arrive JSON-encoded as ``'"a"'``; a
    multiple-choice answer arrives as a JSON array string or a real list; a
    free-text answer is a plain string. We decode the value and, for any item
    matching an option id, expand it to ``"id: label — description"`` so
    downstream agents and readers see the actual decision rather than a bare
    letter. Unmatched items (free text / custom input) pass through unchanged.
    """
    options = options or []
    opts = {str(o.get("id")): o for o in options if isinstance(o, dict)}
    value: Any = raw
    if isinstance(raw, str):
        stripped = raw.strip()
        try:
            value = json.loads(stripped)
        except (json.JSONDecodeError, ValueError):
            value = stripped
    items = value if isinstance(value, list) else [value]
    out: list[str] = []
    for it in items:
        key = str(it)
        opt = opts.get(key)
        if opt:
            label = opt.get("label") or key
            desc = opt.get("description") or ""
            out.append(f"{key}: {label}" + (f" — {desc}" if desc else ""))
        else:
            out.append(key)
    return ", ".join(out)


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class BaseAgent(ABC):
    """Abstract base for all Dagent agents.

    Subclasses **must** implement:
      - ``agent_type`` (property) — unique string identifier
      - ``_execute(context)`` — the actual business logic

    The public ``execute()`` method wraps ``_execute()`` with error handling
    and automatic retry (up to ``max_retries`` attempts).
    """

    def __init__(self, max_retries: int = 3) -> None:
        self._max_retries = max_retries

    # --- abstract contract ---------------------------------------------------

    @property
    @abstractmethod
    def agent_type(self) -> str:
        """Unique identifier for this agent type (e.g. 'analysis', 'proposal')."""
        ...

    @abstractmethod
    async def _execute(self, context: AgentContext) -> AgentResult:
        """Core logic — subclasses implement this."""
        ...

    # --- public API ----------------------------------------------------------

    async def execute(self, context: AgentContext) -> AgentResult:
        """Execute with retry and unified error handling.

        Retries up to ``max_retries`` times on unhandled exceptions.
        If all retries are exhausted, returns a ``failure`` result.
        """
        last_error: Optional[str] = None

        for attempt in range(1, self._max_retries + 1):
            try:
                logger.info(
                    "agent=%s attempt=%d/%d requirement_id=%d",
                    self.agent_type, attempt, self._max_retries, context.requirement_id,
                )
                result = await self._execute(context)

                # Attach useful metadata
                result.metadata.setdefault("agent_type", self.agent_type)
                result.metadata.setdefault("attempt", attempt)
                return result

            except Exception as exc:  # noqa: BLE001
                last_error = f"[attempt {attempt}] {type(exc).__name__}: {exc}\n{traceback.format_exc()}"
                logger.warning(
                    "agent=%s attempt=%d failed: %s",
                    self.agent_type, attempt, exc,
                )
                if attempt < self._max_retries:
                    backoff = 2 ** (attempt - 1)  # 1s, 2s, 4s ...
                    await asyncio.sleep(backoff)

        # All retries exhausted
        return AgentResult.failure(
            error_message=f"Agent '{self.agent_type}' failed after {self._max_retries} attempts.\n{last_error}",
            metadata={"agent_type": self.agent_type},
        )
