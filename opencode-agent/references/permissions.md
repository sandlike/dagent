# Permissions Configuration

Control what operations OpenCode agents can perform. Default: **all allowed**.

## Permission Actions

| Action | Behavior |
|--------|----------|
| `"allow"` | Execute without asking |
| `"ask"` | Prompt user for approval before executing |
| `"deny"` | Completely block the operation |

## Simple Configuration (Global)

```jsonc
{
  "permission": {
    "*": "ask",           // Ask for everything
    "edit": "ask",        // Ask before file edits
    "bash": "ask",        // Ask before shell commands
    "webfetch": "deny"    // Never allow web fetching
  }
}
```

## Granular Bash Permissions

Use glob patterns to control specific commands:

```jsonc
{
  "permission": {
    "bash": {
      "*": "ask",                  // Ask for all commands
      "git status *": "allow",     // Always allow git status
      "git diff *": "allow",       // Always allow git diff
      "git log*": "allow",         // Always allow git log
      "npm test*": "allow",        // Always allow test runs
      "rm -rf *": "deny",          // Never allow destructive deletes
      "grep *": "allow"            // Always allow grep
    }
  }
}
```

**Important:** Rules are evaluated in order. The **last matching** rule wins. Put `*` (catch-all) first, then specific rules.

## Granular File Permissions

Read, edit, glob, grep, and list support pattern/glob-based control:

```jsonc
{
  "permission": {
    "read": {
      "*": "allow",
      "*.env": "deny",
      ".git/*": "deny"
    },
    "edit": {
      "*": "ask",
      "*.test.ts": "allow",
      "*.snap": "deny"
    }
  }
}
```

## Task Permissions (Subagent Control)

Control which subagents an agent can invoke:

```jsonc
{
  "permission": {
    "task": {
      "*": "deny",
      "code-reviewer": "allow",
      "orchestrator-*": "allow",
      "explore": "ask"
    }
  }
}
```

When `deny`, the subagent is completely removed from the Task tool description. Users can still call it directly via `@mention`.

## Skill Permissions

```jsonc
{
  "permission": {
    "skill": {
      "*": "allow",
      "pr-review": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

## Full Permissions Reference

All available permission keys:

| Key | Controls |
|-----|----------|
| `*` | Wildcard for all tools |
| `read` | File reading |
| `edit` | File writing, editing, patching |
| `glob` | Glob pattern file search |
| `grep` | Content search (ripgrep) |
| `list` | Directory listing |
| `bash` | Shell commands (supports pattern matching) |
| `task` | Subagent invocation (glob match on agent names) |
| `external_directory` | File operations outside project worktree |
| `todowrite` | Todo read/write tools |
| `question` | Asking user questions |
| `webfetch` | Web page fetching |
| `websearch` | Web searching |
| `lsp` | Language server protocol operations |
| `doom_loop` | Agent stuck recovery |
| `skill` | Skill tool (glob match on skill names) |

## Agent-Level Permission Overrides

Permissions set on agents override global permissions:

```jsonc
{
  "permission": {
    "edit": "ask",
    "bash": "ask"
  },
  "agent": {
    "build": {
      "permission": {
        "edit": "allow",    // Override: build can always edit
        "bash": {
          "*": "ask",
          "npm test*": "allow"
        }
      }
    },
    "plan": {
      "permission": {
        "edit": "deny",
        "bash": "deny"
      }
    }
  }
}
```

## Markdown Agent Permissions

In agent markdown frontmatter:

```markdown
---
description: Code review without edits
mode: subagent
permission:
  edit: deny
  bash:
    "*": ask
    "git diff": allow
    "git log*": allow
    "grep *": allow
  webfetch: deny
---
Only analyze code and suggest changes.
```
