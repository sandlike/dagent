# Agents Configuration

Agents are specialized AI assistants in OpenCode for specific tasks and workflows.

## Agent Types

### Primary Agents
The main assistants users interact with directly. Switch between them with Tab key.

| Built-in | Description |
|----------|-------------|
| `build` | Default primary agent with all tools enabled for full development work |
| `plan` | Restricted agent for analysis/planning only. Edit and bash default to `ask` |

### Subagents
Specialized assistants called by primary agents or via `@mention`.

| Built-in | Description |
|----------|-------------|
| `general` | General-purpose for complex multi-step tasks; has full tool access |
| `explore` | Fast read-only agent for codebase exploration; cannot modify files |
| `scout` | Read-only agent for external documentation/dependency research |

### Hidden System Agents
Run automatically, not selectable in UI.

| Agent | Purpose |
|-------|---------|
| `compaction` | Compresses long context into summaries |
| `title` | Generates short session titles |
| `summary` | Creates session summaries |

## Configuration: JSON

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    // Override built-in agents
    "build": {
      "mode": "primary",
      "model": "anthropic/claude-sonnet-4-20250514",
      "prompt": "{file:./prompts/build.txt}",
      "temperature": 0.3,
      "permission": {
        "edit": "allow",
        "bash": "allow"
      }
    },
    "plan": {
      "mode": "primary",
      "model": "anthropic/claude-haiku-4-20250514",
      "permission": {
        "edit": "deny",
        "bash": "deny"
      }
    },

    // Custom agents
    "code-reviewer": {
      "description": "Reviews code for best practices and potential issues",
      "mode": "subagent",
      "model": "anthropic/claude-sonnet-4-20250514",
      "prompt": "You are a code reviewer. Focus on security, performance, and maintainability.",
      "permission": {
        "edit": "deny"
      }
    }
  }
}
```

## Configuration: Markdown File

Place files in `~/.config/opencode/agents/` or `.opencode/agents/`. Filename = agent name.

```markdown
---
description: Reviews code for quality and best practices
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
permission:
  edit: deny
  bash: deny
---
You are in code review mode. Focus on:
- Code quality and best practices
- Potential bugs and edge cases
- Performance implications
- Security considerations
Provide constructive feedback without making direct changes.
```

## All Agent Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `description` | string | **Required.** What the agent does and when to use it |
| `mode` | string | `"primary"`, `"subagent"`, or `"all"` (default) |
| `model` | string | Model override in `provider/model-id` format |
| `variant` | string | Default model variant for this agent |
| `temperature` | number | Response randomness (0-1). Default varies by model (0 for most, 0.55 for Qwen) |
| `top_p` | number | Response diversity alternative to temperature (0-1) |
| `steps` | number | Max agentic iterations before forcing text-only response |
| `prompt` | string | Custom system prompt or `{file:./path}` to load from file |
| `disable` | boolean | Set `true` to disable the agent |
| `hidden` | boolean | Hide from @ autocomplete (subagent only) |
| `color` | string | Hex color (`#FF5733`) or theme color (`primary`, `secondary`, `accent`, `success`, `warning`, `error`, `info`) |
| `permission` | object | Per-agent permission overrides (see permissions reference) |
| `tools` | object | **Deprecated.** Use `permission` instead. `true`/`false` per tool |
| `options` | object | Additional provider-specific options passed through directly |
| `maxSteps` | number | **Deprecated.** Use `steps` instead |

> **Note:** Additional keys (not listed above) are passed directly to the provider as model options. Example: `"reasoningEffort": "high"` for OpenAI models.

## Permission Per Agent

Control tool access per agent with pattern matching:

```jsonc
{
  "agent": {
    "build": {
      "permission": {
        "edit": "allow",
        "bash": {
          "git push": "ask",
          "grep *": "allow",
          "*": "deny"
        },
        "task": {
          "*": "deny",
          "code-reviewer": "allow"
        },
        "webfetch": "deny"
      }
    }
  }
}
```

Permission keys and their tools:

| Key | Tools Controlled |
|-----|-----------------|
| `read` | file reading |
| `edit` | write, edit, apply_patch |
| `glob` | file globbing |
| `grep` | content searching |
| `list` | directory listing |
| `bash` | shell commands |
| `task` | subagent invocation (glob patterns match agent names) |
| `external_directory` | reading/writing outside project worktree |
| `todowrite` | todo read/write |
| `webfetch` | web page fetching |
| `websearch` | web search |
| `lsp` | language server protocol |
| `skill` | skill tool (glob patterns) |
| `question` | asking user questions |
| `doom_loop` | recovery when agent appears stuck |

**Rule priority:** Last matching rule wins. Put `*` first, specific rules last.

```jsonc
{
  "permission": {
    "bash": {
      "*": "ask",
      "git status *": "allow"
    }
  }
}
```

## Create Agent via CLI

```bash
opencode agent create
```

Interactive command that asks for location, description, permissions, and generates the markdown file.

## Default Agent

```jsonc
{
  "default_agent": "plan"
}
```

Must be a primary agent. Falls back to `"build"` if invalid. Applies to TUI, CLI, desktop, and GitHub Action.
