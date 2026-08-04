"""ProposalAgent — generates a technical proposal document.

Stage: ``proposing`` in the pipeline state machine.
Output:  Markdown proposal (with Mermaid diagrams, API design, impact assessment).
"""

from __future__ import annotations

import logging
from typing import Any

from dagent_agent.agents.base import AgentContext, AgentResult, BaseAgent
from dagent_agent.services.llm_service import LLMService
from dagent_agent.services.codebase_service import CodebaseService
from dagent_agent.services.document_service import DocumentService

logger = logging.getLogger(__name__)


class ProposalAgent(BaseAgent):
    """Generate a structured technical proposal based on clarified requirements and codebase."""

    def __init__(
        self,
        llm_service: LLMService | None = None,
        codebase_service: CodebaseService | None = None,
        document_service: DocumentService | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._llm = llm_service or LLMService()
        self._codebase = codebase_service or CodebaseService()
        self._document = document_service or DocumentService()

    @property
    def agent_type(self) -> str:
        return "proposal"

    async def _execute(self, context: AgentContext) -> AgentResult:
        clarified_requirement = context.previous_artifacts.get("clarified_requirement", "")
        feasibility_report = context.previous_artifacts.get("feasibility_report", {})

        # 1. Collect relevant code snippets / architecture info
        codebase_context = await self._codebase.gather_context(context.codebase_info)

        # 2. Generate proposal via LLM
        prompt = self._build_prompt(clarified_requirement, feasibility_report, codebase_context)
        llm_response = await self._llm.chat(prompt=prompt, model=context.llm_model)

        # 3. Format as Markdown document
        proposal_doc = self._document.format_proposal(llm_response, context.requirement_id)

        # 4. Pre-select repositories that will be affected
        selected_repos = await self._codebase.select_affected_repos(context.codebase_info, proposal_doc)

        return AgentResult.success(
            output=proposal_doc,
            artifacts={
                "proposal_document": proposal_doc,
                "selected_repositories": [r.name for r in selected_repos],
            },
        )

    # --- helpers (stubs) -----------------------------------------------------

    def _build_prompt(self, requirement: str, feasibility: dict[str, Any], codebase_ctx: str) -> str:
        # TODO: Jinja2 prompt template
        return f"Generate technical proposal for:\n{requirement}\n\nFeasibility:\n{feasibility}\n\nCodebase:\n{codebase_ctx}"
