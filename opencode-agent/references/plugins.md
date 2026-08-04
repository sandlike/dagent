# Plugins & Hooks Configuration

Plugins extend OpenCode by hooking into events and customizing behavior. They are JavaScript/TypeScript modules.

## Loading Plugins

### From Local Files

Place `.js` or `.ts` files in:
- `.opencode/plugins/` — Project-level
- `~/.config/opencode/plugins/` — Global

Files are auto-loaded at startup.

### From npm

```jsonc
{
  "plugin": ["opencode-helicone-session", "opencode-wakatime", "@my-org/custom-plugin"]
}
```

Both regular and scoped npm packages are supported. npm plugins are auto-installed with Bun at startup, cached in `~/.cache/opencode/node_modules/`.

### Load Order

1. Global config (`~/.config/opencode/opencode.json`)
2. Project config (`opencode.json`)
3. Global plugin directory (`~/.config/opencode/plugins/`)
4. Project plugin directory (`.opencode/plugins/`)

Duplicate npm packages (same name + version) loaded once. Local and npm plugins with similar names are loaded separately.

## Plugin Dependencies

For local plugins using npm packages, add `package.json` to the config directory:

```json
// .opencode/package.json
{
  "dependencies": {
    "shescape": "^2.1.0"
  }
}
```

Then import in plugins:

```typescript
import { escape } from "shescape"
```

OpenCode runs `bun install` at startup.

## Plugin Structure

```javascript
// .opencode/plugins/example.js
export const MyPlugin = async ({ project, client, $, directory, worktree }) => {
  console.log("Plugin initialized!")
  return {
    // Hook implementations go here
  }
}
```

Plugin function receives:
- `project` — Current project information
- `client` — OpenCode SDK client for AI interaction
- `$` — Bun shell API for executing commands
- `directory` — Current working directory
- `worktree` — Git worktree path

### TypeScript Support

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    // Type-safe hook implementations
  }
}
```

## Hook Events

### Command Events
- `command.executed`

### File Events
- `file.edited`
- `file.watcher.updated`

### Installation Events
- `installation.updated`

### LSP Events
- `lsp.client.diagnostics`
- `lsp.updated`

### Message Events
- `message.part.removed`
- `message.part.updated`
- `message.removed`
- `message.updated`

### Permission Events
- `permission.asked`
- `permission.replied`

### Server Events
- `server.connected`

### Session Events
- `session.created`
- `session.compacted`
- `session.deleted`
- `session.diff`
- `session.error`
- `session.idle`
- `session.status`
- `session.updated`

### Todo Events
- `todo.updated`

### Shell Events
- `shell.env`

### Tool Events
- `tool.execute.after`
- `tool.execute.before`

### TUI Events
- `tui.prompt.append`
- `tui.command.execute`
- `tui.toast.show`

### Experimental Events
- `experimental.session.compacting`

## Plugin Examples

### Send Notifications

```javascript
export const NotificationPlugin = async ({ project, client, $, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await $`osascript -e 'display notification "Session completed!" with title "opencode"'`
      }
    },
  }
}
```

### .env Protection

```javascript
export const EnvProtection = async ({ project, client, $, directory, worktree }) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "read" && output.args.filePath.includes(".env")) {
        throw new Error("Do not read .env files")
      }
    },
  }
}
```

### Inject Environment Variables

```javascript
export const InjectEnvPlugin = async () => {
  return {
    "shell.env": async (input, output) => {
      output.env.MY_API_KEY = "secret"
      output.env.PROJECT_ROOT = input.cwd
    },
  }
}
```

### Custom Tools

```typescript
import { type Plugin, tool } from "@opencode-ai/plugin"

export const CustomToolsPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      mytool: tool({
        description: "This is a custom tool",
        args: {
          foo: tool.schema.string(),
        },
        async execute(args, context) {
          const { directory, worktree } = context
          return `Hello ${args.foo} from ${directory} (worktree: ${worktree})`
        },
      }),
    },
  }
}
```

If a plugin tool uses the same name as a built-in tool, the plugin tool takes precedence.

### Compaction Hooks

Inject context during session compaction:

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const CompactionPlugin: Plugin = async (ctx) => {
  return {
    "experimental.session.compacting": async (input, output) => {
      output.context.push(`
## Custom Context
Include any state that should persist across compaction:
- Current task status
- Important decisions made
- Files being actively worked on
`)
    },
  }
}
```

Replace compaction prompt entirely:

```typescript
export const CustomCompactionPlugin: Plugin = async (ctx) => {
  return {
    "experimental.session.compacting": async (input, output) => {
      output.prompt = `
You are generating a continuation prompt for a multi-agent swarm session.
Summarize:
1. The current task and its status
2. Which files are being modified and by whom
3. Any blockers or dependencies between agents
4. The next steps to complete the work
`
    },
  }
}
```

When `output.prompt` is set, it completely replaces the default compaction prompt. `output.context` is ignored in this case.

## Logging

Use `client.app.log()` for structured logging:

```typescript
export const MyPlugin = async ({ client }) => {
  await client.app.log({
    body: {
      service: "my-plugin",
      level: "info",
      message: "Plugin initialized",
      extra: { foo: "bar" },
    },
  })
}
```

Levels: `debug`, `info`, `warn`, `error`.
