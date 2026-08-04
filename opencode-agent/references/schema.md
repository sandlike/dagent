# Complete JSON Schema Reference

This is a condensed reference of all top-level configuration keys with their types and descriptions. Schema: `https://opencode.ai/config.json`

## Top-Level Config Keys

| Key | Type | Description |
|-----|------|-------------|
| `$schema` | string | Schema reference: `"https://opencode.ai/config.json"` |
| `shell` | string | Default shell for terminal and bash tool |
| `logLevel` | `"DEBUG"` \| `"INFO"` \| `"WARN"` \| `"ERROR"` | Log level |
| `model` | string | Default model (`provider/model-id`) |
| `small_model` | string | Lightweight model for title generation |
| `default_agent` | string | Default primary agent (falls back to `"build"`) |
| `username` | string | Custom display name in conversations |
| `disabled_providers` | string[] | Blocklist of providers to never load |
| `enabled_providers` | string[] | Whitelist — when set, only these providers load |
| `snapshot` | boolean | Enable/disable undo support (default: `true`) |
| `autoupdate` | boolean \| `"notify"` | Auto-update behavior (default: `true`) |
| `share` | `"manual"` \| `"auto"` \| `"disabled"` | Session sharing control (default: `"manual"`) |
| `formatter` | boolean \| object | Enable/configure code formatters |
| `lsp` | boolean \| object | Enable/configure LSP servers |
| `layout` | `"auto"` \| `"stretch"` | **Deprecated.** Always stretch layout now |
| `autoshare` | boolean | **Deprecated.** Use `share` instead |
| `mode` | object | **Deprecated.** Use `agent` instead |
| `reference` | object | **Deprecated.** Use `references` instead |

## Object Config Keys

All object-type keys below have detailed references:

| Key | Ref File | Description |
|-----|----------|-------------|
| `server` | — | HTTP server config (port, hostname, mDNS, CORS) |
| `command` | `commands.md` | Custom command templates |
| `skills` | `skills.md` | Additional skill paths and URLs |
| `references` | — | Named git/local directory references |
| `agent` | `agents.md` | Agent configurations (primary, subagent, hidden) |
| `provider` | `providers.md` | Provider configs and model overrides |
| `mcp` | `mcp.md` | MCP server configurations (local + remote) |
| `plugin` | `plugins.md` | Plugin npm packages array |
| `permission` | `permissions.md` | Permission controls |
| `watcher` | — | File watcher ignore patterns |
| `attachment` | — | Image attachment size/resize config |
| `tool_output` | — | Tool output truncation thresholds |
| `compaction` | — | Context compaction settings |
| `enterprise` | — | Enterprise URL config |
| `instructions` | — | Additional instruction file paths/globs |
| `experimental` | — | Experimental features |

## SeverConfig

```jsonc
{
  "server": {
    "port": 4096,
    "hostname": "0.0.0.0",
    "mdns": true,
    "mdnsDomain": "opencode.local",
    "cors": ["http://localhost:5173"]
  }
}
```

## References (Local + Git)

```jsonc
{
  "references": {
    "docs": {
      "path": "../product-docs",
      "description": "Use for product behavior and documentation conventions",
      "hidden": false
    },
    "sdk": {
      "repository": "anomalyco/opencode-sdk-js",
      "branch": "main",
      "description": "Use for JavaScript SDK implementation details"
    }
  }
}
```

String shorthand: `"docs": "../docs"` or `"effect": "Effect-TS/effect"`

## Attachments

```jsonc
{
  "attachment": {
    "image": {
      "auto_resize": true,      // default: true
      "max_width": 2000,        // default: 2000
      "max_height": 2000,       // default: 2000
      "max_base64_bytes": 5242880  // default: 5242880 (5MB)
    }
  }
}
```

## Tool Output

```jsonc
{
  "tool_output": {
    "max_lines": 2000,    // default: 2000
    "max_bytes": 51200    // default: 51200 (50KB)
  }
}
```

## Compaction

```jsonc
{
  "compaction": {
    "auto": true,                       // Auto-compact when context is full (default: true)
    "prune": false,                     // Prune old tool outputs (default: false)
    "tail_turns": 2,                    // Recent turns kept verbatim (default: 2)
    "preserve_recent_tokens": 0,        // Max tokens preserved verbatim
    "reserved": 10000                   // Token buffer for compaction
  }
}
```

## Experimental

```jsonc
{
  "experimental": {
    "disable_paste_summary": false,
    "batch_tool": true,
    "openTelemetry": false,
    "primary_tools": ["tool_name"],
    "continue_loop_on_deny": false,
    "mcp_timeout": 10000,
    "policies": [
      {
        "effect": "deny",           // "allow" | "deny"
        "action": "provider.use",   // Currently only "provider.use"
        "resource": "openai"        // Provider name
      }
    ]
  }
}
```

## Enterprise

```jsonc
{
  "enterprise": {
    "url": "https://enterprise.example.com"
  }
}
```

## Instructions

```jsonc
{
  "instructions": [
    "CONTRIBUTING.md",
    "docs/guidelines.md",
    ".cursor/rules/*.md"
  ]
}
```

## Watcher

```jsonc
{
  "watcher": {
    "ignore": ["node_modules/**", "dist/**", ".git/**"]
  }
}
```

## Tools (Deprecated)

```jsonc
{
  "tools": {
    "write": false,
    "bash": false
  }
}
```

Use `permission` instead. `true` = `{"*": "allow"}`, `false` = `{"*": "deny"}`.
