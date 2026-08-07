---
name: grill-me
description: Sharpen a requirement through code-grounded clarification questions before implementation.
---

# Structured Requirement Clarification

1. Read the requirement and all earlier clarification rounds.
2. Inspect the real repository and resolve every fact available from code.
3. Ask only unresolved human decisions, in dependency order.
4. Produce 3-6 focused questions with a concrete, code-grounded recommendation.
5. Use `single`, `multiple`, or `text` question types and the caller's exact JSON contract.
6. Never modify files or return prose outside the requested JSON.
