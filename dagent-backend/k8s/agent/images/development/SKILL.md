---
name: development
description: Implement an approved requirement inside its isolated Workspace and return verified evidence.
---

# Requirement-Scoped Development

1. Read the approved development document, latest feedback, and real repository conventions.
2. Work only inside the mounted requirement Workspace.
3. Make the smallest coherent implementation that satisfies the approved scope.
4. Run focused unit and smoke checks with real commands and preserve their exit codes.
5. Never push, merge, reset, expose secrets, or access another requirement Workspace.
6. Return the caller's exact JSON contract with real changed files and check evidence.
