---
name: opencode-config
description: Guide for configuring OpenCode (https://opencode.ai), an open-source AI coding agent. Covers all configurable aspects: MCP servers, agents, providers, permissions, plugins/hooks, commands, skills, formatters, LSP, references, server settings, TUI, experimental features, and more. Use when the user asks to configure, set up, or modify OpenCode settings, or when generating an opencode.json configuration file.
agent_created: true
---

# OpenCode Configuration Guide

This skill provides comprehensive guidance for configuring [OpenCode](https://opencode.ai), an open-source AI coding agent available as a terminal app (TUI), desktop app, or IDE extension.

## Quick Reference: Configuration Files

| File | Purpose |
|------|---------|
| `opencode.json` / `opencode.jsonc` | Main configuration (JSON/JSONC with comments) |
| `tui.json` / `tui.jsonc` | Terminal UI configuration (themes, keybinds, scroll) |

Config files merge together (later sources override earlier ones for conflicting keys). Schema: `https://opencode.ai/config.json`

### Config Loading Priority (lowest to highest)

1. Remote config (`.well-known/opencode`) — org defaults
2. Global config (`~/.config/opencode/opencode.json`) — user preferences
3. Custom config (`OPENCODE_CONFIG` env var) — custom overrides
4. Project config (`opencode.json` in project) — project-specific settings
5. `.opencode` directory — agents, commands, plugins on disk
6. Inline config (`OPENCODE_CONFIG_CONTENT` env var) — runtime overrides
7. Managed config files (`/Library/Application Support/opencode/` on macOS)
8. macOS MDM managed preferences (`.mobileconfig` via MDM)

### Model Naming Convention

Model names follow the format **`provider/model-name`** (e.g., `deepseek/deepseek-v4-flash`, `anthropic/claude-sonnet-4-5`, `openai/gpt-4o`). When configuring a custom provider model:

```jsonc
{
  "model": "deepseek/deepseek-v4-flash"
}
```

### DeepSeek Provider Configuration

Configure DeepSeek with custom API key and base URL:

```jsonc
{
  "provider": {
    "deepseek": {
      "options": {
        "apiKey": "sk-xxxxxxxxxxxxxxxx",
        "baseURL": "https://api.deepseek.com/v1",
        "timeout": 300000
      }
    }
  },
  "model": "deepseek/deepseek-v4-flash"
}
```

Alternatively, use environment variables:

```jsonc
{
  "provider": {
    "deepseek": {
      "options": {
        "apiKey": "{env:DEEPSEEK_API_KEY}",
        "baseURL": "{env:DEEPSEEK_BASE_URL}"
      }
    }
  },
  "model": "deepseek/deepseek-v4-flash"
}
```

### Read-Only Mode Configuration

To restrict the agent to read-only operations (grep, glob, read only; no file writes, no shell):

```jsonc
{
  "permission": {
    "edit": "deny",   // Disables write / edit / patch tools
    "bash": "deny",   // Disables all shell commands
    "read": "allow",
    "grep": "allow",
    "glob": "allow"
  }
}
```

Permission values:
- `"allow"` — tool runs directly without confirmation
- `"ask"` — prompts user for confirmation before each use
- `"deny"` — tool is completely blocked

### Variable Substitution

Use `{env:VAR_NAME}` for environment variables and `{file:./path/to/file}` for file content:

```jsonc
{
  "model": "{env:OPENCODE_MODEL}",
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      }
    },
    "openai": {
      "options": {
        "apiKey": "{file:~/.secrets/openai-key}"
      }
    }
  }
}
```

## Configuration Sections

When helping the user configure OpenCode, cover these sections as needed. Detailed reference for each section is in `references/`:

| Section | Reference File | What It Covers |
|---------|---------------|----------------|
| **MCP Servers** | `references/mcp.md` | Local and remote MCP server configuration, OAuth, timeouts |
| **Agents** | `references/agents.md` | Primary/subagent/hidden agents, permissions per agent, temperature, steps |
| **Providers** | `references/providers.md` | LLM provider config (Anthropic, OpenAI, Bedrock, local models, etc.) |
| **Permissions** | `references/permissions.md` | Tool-level permission control (ask/allow/deny), glob patterns, bash rules |
| **Plugins & Hooks** | `references/plugins.md` | Plugin system, hook events, custom tools, compaction hooks |
| **Commands** | `references/commands.md` | Custom commands with templates, placeholders, shell output |
| **Skills** | `references/skills.md` | Agent skill discovery, SKILL.md format, permissions |
| **Full Schema** | `references/schema.md` | Complete JSON schema with all config options |

### Other Top-Level Config Options

These can be set directly in `opencode.json`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  // --- Shell ---
  "shell": "zsh",                    // Default shell for terminal and bash tool

  // --- Logging ---
  "logLevel": "INFO",                // DEBUG | INFO | WARN | ERROR

  // --- Default model ---
  "model": "anthropic/claude-sonnet-4-20250514",
  "small_model": "anthropic/claude-haiku-4-20250514",
  "default_agent": "build",          // Default primary agent

  // --- Custom username ---
  "username": "my-display-name",

  // --- Provider management ---
  "disabled_providers": ["openai"],           // Disable specific providers
  "enabled_providers": ["anthropic"],         // Whitelist: only these enabled

  // --- Code formatters ---
  "formatter": true,                         // Enable all built-in formatters
  // Or with overrides:
  // "formatter": {
  //   "prettier": { "disabled": true },
  //   "custom": { "command": ["npx", "prettier", "--write", "$FILE"], "extensions": [".js"] }
  // }

  // --- LSP servers ---
  "lsp": true,                               // Enable all built-in LSPs
  // "lsp": { "typescript": { "disabled": true } }

  // --- Instructions ---
  "instructions": ["CONTRIBUTING.md", "docs/guidelines.md"],

  // --- Snapshots (undo/redo) ---
  "snapshot": true,                          // Enable/disable undo support

  // --- Auto-update ---
  "autoupdate": true,                        // true | false | "notify"

  // --- Sharing ---
  "share": "manual",                         // "manual" | "auto" | "disabled"

  // --- File watcher ---
  "watcher": {
    "ignore": ["node_modules/**", "dist/**"]
  },

  // --- Image attachments ---
  "attachment": {
    "image": {
      "auto_resize": true,
      "max_width": 2000,
      "max_height": 2000,
      "max_base64_bytes": 5242880
    }
  },

  // --- Tool output truncation ---
  "tool_output": {
    "max_lines": 2000,
    "max_bytes": 51200
  },

  // --- Context compaction ---
  "compaction": {
    "auto": true,
    "prune": false,
    "tail_turns": 2,
    "reserved": 10000
  },

  // --- Enterprise ---
  "enterprise": {
    "url": "https://enterprise.example.com"
  },

  // --- Experimental features ---
  "experimental": {
    "disable_paste_summary": false,
    "batch_tool": true,
    "openTelemetry": false,
    "primary_tools": ["tool_name"],
    "continue_loop_on_deny": false,
    "mcp_timeout": 5000,
    "policies": [
      { "effect": "deny", "action": "provider.use", "resource": "openai" }
    ]
  }
}
```

## TUI Configuration

Create `tui.json` or `tui.jsonc` in the config directory. Schema: `https://opencode.ai/tui.json`

```jsonc
{
  "$schema": "https://opencode.ai/tui.json",
  "theme": "tokyonight",
  "scroll_speed": 3,
  "scroll_acceleration": { "enabled": true },
  "diff_style": "auto",
  "mouse": true,
  "attention": {
    "enabled": true,
    "notifications": true,
    "sound": true,
    "volume": 0.4
  },
  "keybinds": {
    "command_list": "ctrl+p"
  }
}
```

Custom themes go in `~/.config/opencode/themes/` or `.opencode/themes/`.

## Directory Structure

Directories use **plural names**:

```
~/.config/opencode/          (global)
.opencode/                    (project)
├── agents/       - Custom agent markdown definitions
├── commands/     - Custom command markdown definitions
├── plugins/      - Plugin JS/TS files
├── skills/       - Skill SKILL.md definitions
├── themes/       - Custom TUI themes
```

## Server Configuration

### Command Reference

| Command | Description |
|---------|-------------|
| `opencode serve` | 无界面 HTTP 服务器，暴露 OpenAPI 端点供客户端使用 |
| `opencode web` | 无界面 HTTP 服务器 + Web 界面，自动打开浏览器 |
| `opencode attach <url>` | 终端连接到已运行的 serve/web 后端 |
| `opencode run --attach <url>` | 以非交互模式发送请求到后端 |

### serve 命令

```bash
# 基本启动
opencode serve

# 指定端口和主机名
opencode serve --port 4096 --hostname 0.0.0.0

# 启用 mDNS 和 CORS
opencode serve --mdns --cors http://localhost:5173 --cors https://app.example.com

# 启用密码认证（推荐生产环境）
OPENCODE_SERVER_PASSWORD=your-password opencode serve
```

`serve` 命令标志：

| 标志 | 默认值 | 说明 |
|------|--------|------|
| `--port` | `4096` | 监听端口 |
| `--hostname` | `127.0.0.1` | 监听主机名（生产环境用 `0.0.0.0`） |
| `--mdns` | `false` | 启用 mDNS 服务发现 |
| `--mdns-domain` | `opencode.local` | mDNS 自定义域名 |
| `--cors` | `[]` | 额外允许的浏览器来源，可多次指定 |

### Authentication

设置环境变量保护服务器：

```bash
OPENCODE_SERVER_PASSWORD=your-password opencode serve
# 用户名默认为 "opencode"，可通过 OPENCODE_SERVER_USERNAME 覆盖
```

客户端连接时需传入密码：

```bash
opencode run --attach http://localhost:4096 --password your-password "Hello"
```

### 配置文件对应 server 选项

在 `opencode.json` 中设置服务器默认值：

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

### HTTP API 概览

服务器暴露 OpenAPI 3.1 规范，访问 `http://<host>:<port>/doc` 可查看 Swagger 文档。

核心端点：

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/global/health` | 健康检查及版本 |
| `GET` | `/global/event` | 全局 SSE 事件流 |
| `POST` | `/session` | 创建新会话 |
| `GET` | `/session` | 列出所有会话 |
| `POST` | `/session/:id/message` | 发送消息并等待响应 |
| `POST` | `/session/:id/prompt_async` | 异步发送消息（不等待） |
| `GET` | `/find?pattern=<pat>` | 搜索文件内容 |
| `GET` | `/find/file?query=<q>` | 按名称查找文件/目录 |
| `GET` | `/file/content?path=<p>` | 读取文件内容 |
| `GET` | `/config` | 获取当前配置 |
| `PATCH` | `/config` | 更新配置 |
| `POST` | `/mcp` | 动态添加 MCP 服务器 |

### 客户端连接方式

```bash
# 方式一：attach TUI 到后端
opencode attach http://10.20.30.40:4096

# 方式二：直接通过 CLI 发送消息
opencode run --attach http://localhost:4096 "Explain async/await"

# 方式三：通过 curl 直接调用 HTTP API
curl -X POST http://localhost:4096/session \
  -H 'Content-Type: application/json' \
  -d '{"title":"my-session"}'

# 获取会话 ID 后发送消息
SESSION_ID=$(curl -s http://localhost:4096/session | jq -r '.[0].id')
curl -X POST "http://localhost:4096/session/$SESSION_ID/message" \
  -H 'Content-Type: application/json' \
  -d '{"parts":[{"type":"content","content":"Hello"}]}'
```

### web 命令

与 `serve` 相同但额外提供 Web UI，会自动打开浏览器：

```bash
opencode web --port 4096 --hostname 0.0.0.0
```

## Managed Settings (Enterprise)

Organizations can enforce settings that users cannot override:

- **macOS**: `/Library/Application Support/opencode/opencode.json` or MDM `.mobileconfig`
- **Linux**: `/etc/opencode/opencode.json`
- **Windows**: `%ProgramData%\opencode\opencode.json`

Verify with: `opencode debug config`

## Working with the User

When the user asks about OpenCode configuration:

1. **Identify what they want to configure** — MCP? Agents? Permissions? A specific provider?
2. **Check their existing config** — Read their `opencode.json` or `~/.config/opencode/opencode.json` if accessible
3. **Load relevant references** — Use `references/` files for detailed syntax and examples
4. **Generate or modify the config** — Write valid JSONC with appropriate comments
5. **Validate** — Ensure schema compatibility (allow comments, allow trailing commas)

For generating a full config from scratch, load `references/schema.md` for the complete JSON schema and iterate through the sections the user needs.
