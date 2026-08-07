"""DevelopmentDocumentAgent — produces an implementation work-plan document.

Stage: development_document_generation (after clarification is confirmed).
Reads the clarified requirement + answers + codebase, and writes a concise
development document as Markdown. The backend stores it as the
`development_document` artifact and advances to the review gate.
"""

from __future__ import annotations

import logging
from typing import Any

from dagent_agent.agents.base import AgentContext, AgentResult, BaseAgent, resolve_answer_text
from dagent_agent.executor.opencode_runner import OpencodeRunner

logger = logging.getLogger(__name__)

DEV_PLAN_PRINCIPLES = """\
You apply the dev-plan method for implementation work-plan generation:
1. Open real files before you cite them — never name a file/module/table you did
   not read. Hallucinated paths are the worst failure mode of a plan.
2. Cite by RELATIVE path under the current directory (e.g. `README.md`); never
   invent absolute paths outside it.
3. Affected components come first — enumerate the files this change touches, each
   grounded in a file you opened, before writing steps.
4. Steps are ordered and concrete — one action per step, each citing its file.
5. Separate data-model changes, API/interface changes, and implementation steps
   into distinct sections; never merge them.
6. Name the risks last; do not implement — your only output is the plan.
"""

OUTPUT_CONTRACT = """\
Reply with ONLY a Markdown document — no prose before or after, no code fences
wrapping the whole thing. Begin directly with the `# Goal & scope` heading.
Keep it under ~400 words. Use exactly these sections, in order:

1. `# Goal & scope` — one paragraph: what is being built.
2. `## Affected components` — `path/to/file` bullets, each with why it is
   touched; every path must be a file you opened.
3. `## Implementation steps` — an ordered, concrete checklist; cite the file
   each step touches.
4. `## Data model changes` — new tables/columns/migrations, or "None".
5. `## API / interface changes` — new/modified endpoints & request/response
   shapes, or "None".
6. `## Risks & open items` — risks or open decisions to watch.
"""


class DevelopmentDocumentAgent(BaseAgent):
    """Generate the development document artifact."""

    def __init__(self, opencode: OpencodeRunner | None = None, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._opencode = opencode or OpencodeRunner()

    @property
    def agent_type(self) -> str:
        return "development_document"

    async def _execute(self, context: AgentContext) -> AgentResult:
        prompt = self._build_prompt(context)
        work_dir = context.extra.get("work_dir", "")
        if not work_dir:
            return AgentResult.failure("No work_dir provided in context")

        document = await self._opencode.run(prompt=prompt, cwd=work_dir)
        document = self._strip_preamble(document).strip()
        if not document:
            return AgentResult.failure("opencode returned an empty document")

        return AgentResult.success(
            output=f"Generated development document ({len(document)} chars)",
            artifacts={"development_document": document, "raw_output": document},
        )

    @staticmethod
    def _strip_preamble(text: str) -> str:
        """Drop any conversational preamble the LLM emitted before the Markdown
        document. The document is required to start with a top-level heading
        ('# ...'); anything before the first such line is narration and is
        discarded as a safety net (the prompt also asks for no preamble)."""
        lines = text.splitlines()
        for i, line in enumerate(lines):
            if line.lstrip().startswith("# "):
                return "\n".join(lines[i:])
        return text

    def _build_prompt(self, context: AgentContext) -> str:
        extra = context.extra
        title = extra.get("requirement_title", "")
        description = extra.get("requirement_description", "")

        # Prefer the PM-confirmed requirement document (the clarified requirement)
        # over the raw original description; fall back to the description when no
        # confirmed document exists yet.
        requirement_doc = context.previous_artifacts.get("requirement_document")
        if isinstance(requirement_doc, str) and requirement_doc.strip():
            requirement_block = requirement_doc
        else:
            requirement_block = f"Title: {title}\nDescription:\n{description}"

        rounds = context.previous_artifacts.get("clarification_rounds") or []
        qa_lines: list[str] = []
        for rnd in rounds:
            for q in rnd.get("questions", []):
                opts = q.get("options") or []
                # resolve each answer id to its option label (+ description) so
                # the agent sees the actual PM decision, not a bare "a"/"b"
                resolved = [resolve_answer_text(a.get("answer"), opts) for a in q.get("answers", [])]
                answer_str = ", ".join(resolved) or "(unanswered)"
                # list the full option set so the agent also knows what was NOT chosen
                options_str = (
                    "; ".join(f"{o.get('id')}={o.get('label')}" for o in opts)
                    or "(free-text)"
                )
                rec = q.get("ai_recommendation") or "(none)"
                qa_lines.append(
                    f"- {q.get('question')}\n"
                    f"  PM's answer: {answer_str}\n"
                    f"  (all options: {options_str})\n"
                    f"  (AI recommended: {rec})"
                )
        qa_block = "\n".join(qa_lines) if qa_lines else "(no clarification answers)"

        sections = [
            "You are the dagent Development Document Agent.",
            "",
            DEV_PLAN_PRINCIPLES,
            "=== REQUIREMENT (clarified) ===",
            requirement_block,
            "",
            "=== CLARIFIED ANSWERS (authoritative) ===",
            "These are the PM's final decisions. When multiple rounds exist, LATER",
            "rounds OVERRIDE earlier ones, and these answers OVERRIDE the requirement",
            "text above wherever they conflict. Treat them as ground truth.",
            qa_block,
            "",
            "=== CODEBASE ===",
            "The current directory is the project repository bound to this",
            "requirement. Read its real files to identify what this change touches,",
            "then cite them by RELATIVE path under this directory (e.g. `README.md`).",
            "Do not invent absolute paths outside this directory.",
            "",
            "=== OUTPUT CONTRACT ===",
            OUTPUT_CONTRACT,
            "First explore the codebase, then emit the Markdown document.",
        ]
        return "\n".join(sections)
