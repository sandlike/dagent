# Commands Configuration

Custom commands let users define reusable prompts accessible via `/command-name` in the TUI.

## Configuration: JSON

```jsonc
{
  "command": {
    "test": {
      "template": "Run the full test suite with coverage report and show any failures.\nFocus on the failing tests and suggest fixes.",
      "description": "Run tests with coverage",
      "agent": "build",
      "model": "anthropic/claude-haiku-4-20250514"
    },
    "component": {
      "template": "Create a new React component named $ARGUMENTS with TypeScript support.\nInclude proper typing and basic structure.",
      "description": "Create a new component"
    }
  }
}
```

## Configuration: Markdown File

Place files in `~/.config/opencode/commands/` or `.opencode/commands/`. Filename = command name.

`.opencode/commands/test.md`:

```markdown
---
description: Run tests with coverage
agent: build
model: anthropic/claude-sonnet-4-20250514
---

Run the full test suite with coverage report and show any failures.
Focus on the failing tests and suggest fixes.
```

Usage: `/test`

## Command Options

| Option | Required | Description |
|--------|----------|-------------|
| `template` | **Yes** | The prompt sent to the LLM |
| `description` | No | Description shown in TUI autocomplete |
| `agent` | No | Agent to execute the command (must be a subagent) |
| `model` | No | Model override (`provider/model-id`) |
| `subtask` | No | Force subagent invocation (even for primary agents). Keeps context clean. |

## Template Placeholders

### Arguments (`$ARGUMENTS`)

```markdown
---
description: Create a new component
---

Create a new React component named $ARGUMENTS with TypeScript support.
```

Usage: `/component Button` — `$ARGUMENTS` becomes `Button`.

### Positional Parameters

```markdown
---
description: Create a new file with content
---

Create a file named $1 in the directory $2
with the following content: $3
```

Usage: `/create-file config.json src "{ \"key\": \"value\" }"`
- `$1` = `config.json`
- `$2` = `src`
- `$3` = `{ "key": "value" }`

### Shell Output (`!command`)

Inject command output into the prompt:

```markdown
---
description: Analyze test coverage
---

Here are the current test results:

!`npm test`

Based on these results, suggest improvements to increase coverage.
```

Commands run in the project root directory.

### File References (`@`)

Include file contents in commands:

```markdown
---
description: Review component
---

Review the component in @src/components/Button.tsx.
Check for performance issues and suggest improvements.
```

## Overriding Built-in Commands

Custom commands with the same name as built-in commands (like `/init`, `/undo`, `/redo`, `/share`, `/help`) will override them.

## Built-in Commands

OpenCode includes: `/init`, `/undo`, `/redo`, `/share`, `/help`, `/connect`, `/models`, `/mode`, `/clear`, and more.
