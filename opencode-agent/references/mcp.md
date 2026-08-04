# MCP Server Configuration

OpenCode supports Model Context Protocol (MCP) servers for extending tool capabilities.

## MCP Server Types

### Local MCP Server

Runs a local process with command and arguments:

```jsonc
{
  "mcp": {
    "my-local-server": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
      "cwd": "/path/to/working/dir",
      "environment": {
        "MY_VAR": "value"
      },
      "enabled": true,
      "timeout": 10000
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Must be `"local"` |
| `command` | Yes | Array: command and arguments |
| `cwd` | No | Working directory (relative paths resolve from workspace) |
| `environment` | No | Environment variables for the MCP process |
| `enabled` | No | Enable on startup (defaults to true) |
| `timeout` | No | Request timeout in ms (default: 5000) |

### Remote MCP Server

Connects to a remote MCP endpoint (HTTP):

```jsonc
{
  "mcp": {
    "jira": {
      "type": "remote",
      "url": "https://jira.example.com/mcp",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer {env:JIRA_TOKEN}"
      },
      "timeout": 15000
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Must be `"remote"` |
| `url` | Yes | Remote MCP server URL |
| `enabled` | No | Enable on startup |
| `headers` | No | Custom HTTP headers |
| `oauth` | No | OAuth2 config or `false` to disable auto-detection |
| `timeout` | No | Request timeout in ms (default: 5000) |

### Remote + OAuth Configuration

```jsonc
{
  "mcp": {
    "secured-server": {
      "type": "remote",
      "url": "https://api.example.com/mcp",
      "oauth": {
        "clientId": "my-client-id",
        "clientSecret": "{env:OAUTH_SECRET}",
        "scope": "read write",
        "callbackPort": 19876,
        "redirectUri": "http://127.0.0.1:19876/mcp/oauth/callback"
      }
    }
  }
}
```

OAuth fields:
- `clientId` — OAuth client ID (if not provided, dynamic client registration RFC 7591 is attempted)
- `clientSecret` — OAuth client secret
- `scope` — OAuth scopes to request
- `callbackPort` — Local callback port (default: 19876)
- `redirectUri` — Full OAuth redirect URI (default: `http://127.0.0.1:19876/mcp/oauth/callback`)

### Enable/Disable Without Full Config

To simply enable or disable a server without repeating its full config:

```jsonc
{
  "mcp": {
    "jira": {
      "enabled": true
    }
  }
}
```

## Organization-Default MCP (Remote Config)

Organizations can provide default MCP server configs via `.well-known/opencode`:

```jsonc
{
  "mcp": {
    "jira": {
      "type": "remote",
      "url": "https://jira.example.com/mcp",
      "enabled": false
    }
  }
}
```

Users can then enable it in their local config:

```jsonc
{
  "mcp": {
    "jira": { "enabled": true }
  }
}
```

## Global MCP Timeout

Set a global timeout for all MCP requests:

```jsonc
{
  "experimental": {
    "mcp_timeout": 10000
  }
}
```

## Common MCP Server Examples

### Filesystem MCP
```jsonc
{
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
    }
  }
}
```

### GitHub MCP
```jsonc
{
  "mcp": {
    "github": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "environment": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "{env:GITHUB_TOKEN}"
      }
    }
  }
}
```

### Postgres/SQL MCP
```jsonc
{
  "mcp": {
    "postgres": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-postgres", "{env:DATABASE_URL}"]
    }
  }
}
```
