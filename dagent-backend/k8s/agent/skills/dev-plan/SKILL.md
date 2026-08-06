---
name: dev-plan
description: Produce a grounded implementation plan from a clarified requirement and real repository files.
---

# Dev Plan - Grounded Implementation Work Plan

Turn a clarified requirement into an implementation plan another engineer can execute. The current workspace is read-only during planning.

## Principles

1. Open real files before citing them. Never name a file, module, table, endpoint, or dependency you did not inspect.
2. Cite relative paths under the current workspace. Never invent absolute paths.
3. Identify affected components before writing implementation steps.
4. Make steps ordered and concrete, with one action per step and the affected file named.
5. Keep data-model changes, API/interface changes, implementation steps, rollback, and tests separate.
6. Later clarification answers override earlier answers, and confirmed answers override conflicting original requirement text.
7. Do not modify code while producing the development document.

## Required Content

- Goals and non-goals.
- Affected modules with verified relative paths and the reason each is affected.
- Frontend, backend, Agent, data, and API changes where applicable.
- Ordered implementation steps.
- Risks with mitigations, rollback steps, focused tests, and an acceptance checklist.
- Follow the caller's structured JSON schema exactly, even when another presentation format would be shorter.

## Workflow

1. Read the confirmed requirement document and every clarification round.
2. Resolve conflicts using the latest answer.
3. Explore the repository and open each file that may be cited.
4. Build the affected-component list first.
5. Produce the ordered plan in the caller's requested JSON format without conversational preamble.
