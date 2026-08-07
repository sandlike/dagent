"""ClarificationAgent — produces structured clarification questions.

Stage: requirement_clarification.
Method: the grill-me skill (relentful interview, facts-looked-up-in-code, every
question carries a recommendation). Runs opencode (read-only) over the cloned
codebase and parses its JSON reply into the backend's question contract.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from dagent_agent.agents.base import AgentContext, AgentResult, BaseAgent, resolve_answer_text
from dagent_agent.executor.opencode_runner import OpencodeRunner

logger = logging.getLogger(__name__)

VALID_TYPES = {"single", "multiple", "text"}

GRILL_ME_PRINCIPLES = """\
You apply the grill-me method for requirement clarification:
1. Walk the decision tree — identify the unresolved decisions that block implementation,
   resolve dependencies between them, put each as ONE question.
2. Look up facts YOURSELF — if something can be answered by reading the codebase in the
   current directory (modules, data models, conventions, dependencies), find it; do NOT
   ask the human about it. Only ask about decisions that are genuinely the human's to make.
3. Attach your recommendation to EVERY question — you read the code, so you are the most
   informed person; give your best-guess answer and justify it with what you found.
4. One focused concern per question. Never bundle two decisions.
5. Do NOT implement. Your only output is the question set.
"""

OUTPUT_CONTRACT = """\
Reply with ONLY a JSON array (no markdown fences, no prose before or after).
Produce 3–6 questions. Schema:

[
  {
    "question": "<the decision to put to the human, one sentence>",
    "question_type": "single" | "multiple" | "text",
    "required": true,
    "options": [
      {"id": "a", "label": "<short label>", "description": "<what it means>"}
    ],
    "ai_recommendation": "<the id of your recommended option, or a concrete answer, plus a one-line reason grounded in the codebase>"
  }
]

Rules:
- "single"/"multiple" questions MUST have 2–4 options, each with a unique short id
  (e.g. "a","b"), a label, and a description.
- "text" questions use options: [].
- question_type must be exactly "single", "multiple", or "text".
- Ground each question in the codebase: name the file/module/pattern that motivates it.
"""


class ClarificationAgent(BaseAgent):
    """Generate structured clarification questions grounded in the codebase."""

    def __init__(self, opencode: OpencodeRunner | None = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._opencode = opencode or OpencodeRunner()

    @property
    def agent_type(self) -> str:
        return "clarification"

    async def _execute(self, context: AgentContext) -> AgentResult:
        prompt = self._build_prompt(context)
        work_dir = context.extra.get("work_dir", "")
        if not work_dir:
            return AgentResult.failure("No work_dir provided in context")

        raw = await self._opencode.run(prompt=prompt, cwd=work_dir)
        questions = self._parse_questions(raw)
        if not questions:
            return AgentResult.failure(
                f"Failed to parse any valid questions from opencode output: {raw[:500]}"
            )

        return AgentResult.success(
            output=f"Generated {len(questions)} clarification questions",
            artifacts={"clarification_questions": questions, "raw_output": raw},
        )

    def _build_prompt(self, context: AgentContext) -> str:
        extra = context.extra
        title = extra.get("requirement_title", "")
        description = extra.get("requirement_description", "")
        priority = extra.get("requirement_priority", "P2")

        sections = [
            "You are the dagent Requirement Clarification Agent.",
            "",
            GRILL_ME_PRINCIPLES,
            "=== THE REQUIREMENT ===",
            f"Title: {title}",
            f"Priority: {priority}",
            f"Description:\n{description}",
            "",
            "=== THE CODEBASE ===",
            "The current directory contains the project's source repository. Read it",
            "(list the tree, read key files, grep) to ground your questions in reality.",
            "",
        ]

        rounds = context.previous_artifacts.get("clarification_rounds") or []
        if rounds:
            sections.append("=== PREVIOUS CLARIFICATION (do NOT re-ask these) ===")
            for rnd in rounds:
                sections.append(f"Round {rnd.get('round_no')}:")
                for q in rnd.get("questions", []):
                    opts = q.get("options") or []
                    resolved = [resolve_answer_text(a.get("answer"), opts) for a in q.get("answers", [])]
                    answer_str = ", ".join(resolved) or "(unanswered)"
                    options_str = (
                        "; ".join(f"{o.get('id')}={o.get('label')}" for o in opts)
                        or "(free-text)"
                    )
                    sections.append(
                        f"  - Q: {q.get('question')} | type: {q.get('question_type')} "
                        f"| your recommendation: {q.get('ai_recommendation')} "
                        f"| PM answered: {answer_str} | (options: {options_str})"
                    )
            sections.append("Build on the answers above; ask the NEXT unresolved decisions.")
            sections.append("")

        sections.append("=== OUTPUT CONTRACT ===")
        sections.append(OUTPUT_CONTRACT)
        sections.append("First explore the codebase, then emit the JSON array.")
        return "\n".join(sections)

    def _parse_questions(self, raw: str) -> list[dict[str, Any]]:
        """Extract and validate the JSON question array from opencode's reply."""
        array_text = self._extract_json_array(raw)
        if not array_text:
            return []
        try:
            data = json.loads(array_text)
        except json.JSONDecodeError:
            return []
        if not isinstance(data, list):
            return []

        questions: list[dict[str, Any]] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            q = self._normalise_question(item)
            if q:
                questions.append(q)
        return questions

    @staticmethod
    def _extract_json_array(text: str) -> str | None:
        """Find the first JSON array in *text* (handles ```json fences + prose)."""
        # Strip markdown code fences if present.
        fence = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
        if fence:
            return fence.group(1)
        # Otherwise grab from the first '[' to the last ']'.
        start = text.find("[")
        end = text.rfind("]")
        if start == -1 or end == -1 or end <= start:
            return None
        return text[start : end + 1]

    @staticmethod
    def _normalise_question(item: dict[str, Any]) -> dict[str, Any] | None:
        question = (item.get("question") or "").strip()
        qtype = (item.get("question_type") or "").strip()
        if not question or qtype not in VALID_TYPES:
            return None

        options = item.get("options") or []
        norm_options: list[dict[str, Any]] = []
        if qtype in ("single", "multiple"):
            for opt in options:
                if not isinstance(opt, dict):
                    continue
                label = (opt.get("label") or "").strip()
                if not label:
                    continue
                norm_options.append(
                    {
                        "id": str(opt.get("id") or label)[:40],
                        "label": label,
                        "description": (opt.get("description") or "").strip(),
                    }
                )
            if len(norm_options) < 2:
                return None

        return {
            "question": question,
            "question_type": qtype,
            "required": bool(item.get("required", True)),
            "options": norm_options,
            "ai_recommendation": (item.get("ai_recommendation") or "").strip(),
        }
