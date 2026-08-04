"""DocumentService — format and render proposal / test-plan documents.

Uses Jinja2 templates to produce well-structured Markdown output.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class DocumentService:
    """Generate structured Markdown documents from LLM output."""

    def format_proposal(self, llm_output: str, requirement_id: int) -> str:
        """Wrap raw LLM output into a standard proposal template."""
        # TODO: use Jinja2 template with sections:
        #   1. Background & Goals
        #   2. Architecture (Mermaid)
        #   3. API Design
        #   4. Impact Assessment
        #   5. Affected Repositories
        #   6. Risks
        #   7. Test Strategy
        header = f"# Technical Proposal — Requirement #{requirement_id}\n\n"
        return header + llm_output

    def format_test_plan(self, llm_output: str, requirement_id: int) -> str:
        """Wrap raw LLM output into a standard test plan template."""
        # TODO: use Jinja2 template with sections:
        #   1. Test Scope
        #   2. Test Strategy
        #   3. Test Cases
        #   4. Expected Results
        header = f"# Test Plan — Requirement #{requirement_id}\n\n"
        return header + llm_output
