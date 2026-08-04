"""ClarificationAgent — generates multiple-choice clarification questions.

Stage: ``clarifying`` in the pipeline state machine.
Output:  list of clarification points with 2-4 options each (A2UI pattern).
"""

from __future__ import annotations

import logging
from typing import Any

from dagent_agent.agents.base import AgentContext, AgentResult, BaseAgent
from dagent_agent.services.llm_service import LLMService

logger = logging.getLogger(__name__)


class ClarificationAgent(BaseAgent):
    """Generate structured clarification questions with selectable options."""

    def __init__(self, llm_service: LLMService | None = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._llm = llm_service or LLMService()

    @property
    def agent_type(self) -> str:
        return "clarification"

    async def _execute(self, context: AgentContext) -> AgentResult:
        requirement_desc = context.extra.get("requirement_description", "")
        feasibility_report = context.previous_artifacts.get("feasibility_report", {})
        user_selections = context.extra.get("user_selections", None)

        if user_selections is not None:
            # Process user answers and check if more clarification is needed
            return await self._process_answers(context, user_selections)

        # Generate initial clarification questions
        prompt = self._build_questions_prompt(requirement_desc, feasibility_report)
        llm_response = await self._llm.chat(prompt=prompt, model=context.llm_model)
        questions = self._parse_questions(llm_response)

        return AgentResult.success(
            output=llm_response,
            artifacts={"clarification_questions": questions},
        )

    async def _process_answers(self, context: AgentContext, selections: list[dict[str, Any]]) -> AgentResult:
        # TODO: evaluate whether answers are sufficient or more rounds needed
        return AgentResult.success(
            output="Clarification complete",
            artifacts={"clarified": True, "selections": selections},
        )

    # --- helpers (stubs) -----------------------------------------------------

    def _build_questions_prompt(self, requirement_desc: str, feasibility_report: dict[str, Any]) -> str:
        # TODO: Jinja2 prompt template
        return f"Generate clarification questions for:\n{requirement_desc}\n\nFeasibility:\n{feasibility_report}"

    def _parse_questions(self, llm_response: str) -> list[dict[str, Any]]:
        # TODO: structured parsing — each question with 2-4 options
        return []
