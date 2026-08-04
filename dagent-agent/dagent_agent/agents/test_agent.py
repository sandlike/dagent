"""TestAgent — generates test plans and executes automated tests.

Stage: ``testing`` in the pipeline state machine.
Output:  test plan document + test execution report (pass rate, coverage).
"""

from __future__ import annotations

import logging
from typing import Any

from dagent_agent.agents.base import AgentContext, AgentResult, BaseAgent
from dagent_agent.services.llm_service import LLMService

logger = logging.getLogger(__name__)

MAX_FIX_RETRIES = 3


class TestAgent(BaseAgent):
    """Generate test cases, execute them in a sandbox, and auto-fix failures."""

    def __init__(self, llm_service: LLMService | None = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._llm = llm_service or LLMService()

    @property
    def agent_type(self) -> str:
        return "test"

    async def _execute(self, context: AgentContext) -> AgentResult:
        proposal_document = context.previous_artifacts.get("proposal_document", "")
        code_changes = context.previous_artifacts.get("code_changes", "")

        # 1. Generate test plan
        test_plan = await self._generate_test_plan(context, proposal_document, code_changes)

        # 2. Generate test code
        test_code = await self._generate_test_code(context, test_plan)

        # 3. Execute tests in sandbox
        report = await self._execute_tests(context, test_code)

        # 4. Retry loop: fix failures up to MAX_FIX_RETRIES
        fix_attempts = 0
        while report.get("failed_count", 0) > 0 and fix_attempts < MAX_FIX_RETRIES:
            fix_attempts += 1
            logger.info("test fix attempt %d/%d", fix_attempts, MAX_FIX_RETRIES)
            test_code = await self._fix_failed_tests(context, test_code, report)
            report = await self._execute_tests(context, test_code)

        if report.get("failed_count", 0) > 0:
            return AgentResult.needs_human(
                error_message=f"Tests still failing after {MAX_FIX_RETRIES} fix attempts",
                artifacts={"test_plan": test_plan, "test_report": report},
            )

        return AgentResult.success(
            output="All tests passed",
            artifacts={"test_plan": test_plan, "test_report": report},
        )

    # --- helpers (stubs) -----------------------------------------------------

    async def _generate_test_plan(self, context: AgentContext, proposal: str, code_changes: str) -> str:
        prompt = f"Generate test plan for:\nProposal:\n{proposal}\n\nCode changes:\n{code_changes}"
        return await self._llm.chat(prompt=prompt, model=context.llm_model)

    async def _generate_test_code(self, context: AgentContext, test_plan: str) -> str:
        # TODO: generate actual test code from plan
        return ""

    async def _execute_tests(self, context: AgentContext, test_code: str) -> dict[str, Any]:
        # TODO: run tests in Docker sandbox
        return {"total": 0, "passed": 0, "failed_count": 0, "coverage": "0%"}

    async def _fix_failed_tests(self, context: AgentContext, test_code: str, report: dict[str, Any]) -> str:
        # TODO: ask LLM to fix failures
        return test_code
