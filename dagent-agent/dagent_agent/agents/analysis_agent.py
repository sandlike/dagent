"""AnalysisAgent — analyses requirement feasibility against the codebase.

Stage: ``analyzing`` in the pipeline state machine.
Output:  feasibility report (feasible / infeasible) with per-aspect analysis.
"""

from __future__ import annotations

import logging
from typing import Any

from dagent_agent.agents.base import AgentContext, AgentResult, BaseAgent
from dagent_agent.services.llm_service import LLMService
from dagent_agent.services.codebase_service import CodebaseService

logger = logging.getLogger(__name__)


class AnalysisAgent(BaseAgent):
    """Combine codebase analysis with LLM reasoning to produce a feasibility report."""

    def __init__(self, llm_service: LLMService | None = None, codebase_service: CodebaseService | None = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._llm = llm_service or LLMService()
        self._codebase = codebase_service or CodebaseService()

    @property
    def agent_type(self) -> str:
        return "analysis"

    async def _execute(self, context: AgentContext) -> AgentResult:
        # 1. Gather codebase structure summaries
        codebase_summaries: list[dict[str, Any]] = []
        for repo in context.codebase_info:
            summary = await self._codebase.analyse_structure(repo)
            codebase_summaries.append(summary)

        # 2. Build prompt with requirement description + codebase context
        requirement_desc = context.extra.get("requirement_description", "")
        prompt = self._build_prompt(requirement_desc, codebase_summaries)

        # 3. Ask LLM for feasibility assessment
        llm_response = await self._llm.chat(
            prompt=prompt,
            model=context.llm_model,
        )

        # 4. Parse response into structured report
        report = self._parse_report(llm_response, context.requirement_id)

        feasibility = report.get("feasibility", "infeasible")
        if feasibility == "feasible":
            return AgentResult.success(
                output=llm_response,
                artifacts={"feasibility_report": report},
            )
        else:
            return AgentResult.needs_human(
                error_message=f"Requirement deemed infeasible: {report.get('summary', '')}",
                artifacts={"feasibility_report": report},
            )

    # --- helpers (stubs) -----------------------------------------------------

    def _build_prompt(self, requirement_desc: str, codebase_summaries: list[dict[str, Any]]) -> str:
        # TODO: implement Jinja2 prompt template
        return f"Analyse feasibility of:\n{requirement_desc}\n\nCodebase:\n{codebase_summaries}"

    def _parse_report(self, llm_response: str, requirement_id: int) -> dict[str, Any]:
        # TODO: structured parsing of LLM output
        return {
            "requirement_id": requirement_id,
            "feasibility": "feasible",
            "summary": llm_response,
            "analysis": [],
        }
