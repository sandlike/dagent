# Skills Configuration

Agent skills let OpenCode discover reusable instructions from your repo or home directory. Skills are loaded on-demand via the native `skill` tool.

## Skill Directory Locations

OpenCode searches these locations (plural directory names):

| Location | Scope |
|----------|-------|
| `.opencode/skills/<name>/SKILL.md` | Project |
| `~/.config/opencode/skills/<name>/SKILL.md` | Global |
| `.claude/skills/<name>/SKILL.md` | Project (Claude-compatible) |
| `~/.claude/skills/<name>/SKILL.md` | Global (Claude-compatible) |
| `.agents/skills/<name>/SKILL.md` | Project (agent-compatible) |
| `~/.agents/skills/<name>/SKILL.md` | Global (agent-compatible) |

For project-local paths, OpenCode walks up from cwd to git worktree root, loading matching skills along the way.

## Additional Skill Paths (Config)

```jsonc
{
  "skills": {
    "paths": ["/path/to/extra/skills", "./team-skills"],
    "urls": ["https://example.com/.well-known/skills/"]
  }
}
```

## SKILL.md Format

Each `SKILL.md` must start with YAML frontmatter:

```markdown
---
name: git-release
description: Create consistent releases and changelogs
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
  workflow: github
---

## What I do

- Draft release notes from merged PRs
- Propose a version bump
- Provide a copy-pasteable `gh release create` command

## When to use me

Use this when you are preparing a tagged release.
Ask clarifying questions if the target versioning scheme is unclear.
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | **Yes** | Lowercase alphanumeric + hyphens, 1-64 chars. Must match directory name. Regex: `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `description` | **Yes** | 1-1024 chars. Specific enough for agents to choose correctly |
| `license` | No | License identifier (e.g., "MIT") |
| `compatibility` | No | Compatibility hint (e.g., "opencode") |
| `metadata` | No | String-to-string map for arbitrary metadata |

## How Skills Work

1. OpenCode lists available skills in the `skill` tool description
2. The agent sees: `<skill><name>git-release</name><description>Create consistent releases...</description></skill>`
3. Agent loads a skill by calling: `skill({ name: "git-release" })`
4. Full SKILL.md content is injected into agent context

## Skill Permissions

Control skill access with glob patterns:

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

| Permission | Behavior |
|------------|----------|
| `allow` | Skill loads immediately |
| `deny` | Skill hidden from agent, access rejected |
| `ask` | User prompted for approval before loading |

### Per-Agent Skill Permissions

```jsonc
{
  "agent": {
    "plan": {
      "permission": {
        "skill": {
          "internal-*": "allow"
        }
      }
    }
  }
}
```

Or in markdown frontmatter:

```markdown
---
permission:
  skill:
    "documents-*": "allow"
---
```

## Disable Skill Tool

For agents that shouldn't use skills:

```jsonc
{
  "agent": {
    "plan": {
      "tools": {
        "skill": false
      }
    }
  }
}
```

When disabled, `<available_skills>` section is omitted entirely.

## Troubleshooting

If a skill doesn't show up:
1. Verify `SKILL.md` is spelled in all caps
2. Check frontmatter includes `name` and `description`
3. Ensure skill names are unique across all locations
4. Check permissions — skills with `deny` are hidden from agents
