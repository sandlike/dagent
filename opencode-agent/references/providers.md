# Providers Configuration

OpenCode supports 75+ LLM providers via the AI SDK. Configure providers and models in `opencode.json`.

## Basic Provider Setup

```jsonc
{
  "provider": {},
  "model": "anthropic/claude-sonnet-4-20250514",
  "small_model": "anthropic/claude-haiku-4-20250514"
}
```

- `model` — Primary model (format: `provider/model-id`)
- `small_model` — Lightweight model for title generation, etc.
- API keys stored via `/connect` command in `~/.local/share/opencode/auth.json`

## Provider Options

```jsonc
{
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}",
        "baseURL": "https://api.anthropic.com/v1",
        "timeout": 600000,
        "headerTimeout": 30000,
        "chunkTimeout": 30000,
        "setCacheKey": true
      }
    }
  }
}
```

| Option | Description |
|--------|-------------|
| `apiKey` | API key (use `{env:VAR}` or `{file:./path}`) |
| `baseURL` | Custom API base URL (for proxies/custom endpoints) |
| `timeout` | Full request timeout in ms (default: 300000). Set `false` to disable |
| `headerTimeout` | Timeout for response headers in ms. Set `false` to disable |
| `chunkTimeout` | Timeout between SSE chunks in ms |
| `setCacheKey` | Enable promptCacheKey for this provider (default: false) |
| `enterpriseUrl` | GitHub Enterprise URL for Copilot authentication |

## Custom Model Configuration

Override or add model definitions:

```jsonc
{
  "provider": {
    "openrouter": {
      "models": {
        "some-model": {
          "name": "Display Name",
          "id": "actual-model-id",
          "cost": {
            "input": 0.000015,
            "output": 0.00006,
            "cache_read": 0.00000375,
            "cache_write": 0.000015
          },
          "limit": {
            "context": 200000,
            "input": 200000,
            "output": 32768
          }
        }
      }
    }
  }
}
```

### Model Fields

| Field | Description |
|-------|-------------|
| `id` | Model identifier string |
| `name` | Display name in UI |
| `family` | Model family name |
| `attachment` | Whether model supports file attachments |
| `reasoning` | Whether model supports reasoning |
| `temperature` | Whether temperature can be set |
| `tool_call` | Whether model supports tool calling |
| `experimental` | Mark as experimental |
| `status` | `"alpha"`, `"beta"`, `"deprecated"`, `"active"` |
| `cost` | Pricing: `input`, `output`, `cache_read`, `cache_write`, `context_over_200k` |
| `limit` | Limits: `context`, `input`, `output` tokens |
| `modalities` | `input`/`output`: arrays of `"text"`, `"audio"`, `"image"`, `"video"`, `"pdf"` |
| `headers` | Per-model HTTP headers |
| `options` | Provider-specific options |
| `variants` | Variant configuration (e.g., `{ "beta": { "disabled": true } }`) |

## Enabling/Disabling Providers

```jsonc
{
  // Blocklist: these providers never load
  "disabled_providers": ["openai", "gemini"],

  // Whitelist: when set, ONLY these providers are enabled (ignores all others)
  "enabled_providers": ["anthropic", "openai"]
}
```

`disabled_providers` takes priority over `enabled_providers`.

## Custom Provider (OpenAI-Compatible APIs)

For local models or custom endpoints, use `@ai-sdk/openai-compatible`:

```jsonc
{
  "provider": {
    "my-local-llm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "My Local LLM",
      "options": {
        "baseURL": "http://127.0.0.1:8080/v1"
      },
      "models": {
        "qwen3-coder": {
          "name": "Qwen3-Coder (local)",
          "limit": {
            "context": 128000,
            "output": 65536
          }
        }
      }
    }
  }
}
```

## Common Provider Configurations

### Anthropic
```jsonc
{
  "provider": {
    "anthropic": {
      "options": {
        "timeout": 600000,
        "setCacheKey": true
      }
    }
  }
}
```
Auth: Run `/connect` → Anthropic → OAuth (Claude Pro/Max). Or set `ANTHROPIC_API_KEY`.

### OpenAI
```jsonc
{
  "provider": {
    "openai": {
      "options": {
        "timeout": 600000
      }
    }
  }
}
```
Auth: Run `/connect` → OpenAI → ChatGPT Plus/Pro OAuth. Or set `OPENAI_API_KEY`.

### Amazon Bedrock
```jsonc
{
  "provider": {
    "amazon-bedrock": {
      "options": {
        "region": "us-east-1",
        "profile": "my-aws-profile",
        "endpoint": "https://bedrock-runtime.us-east-1.vpce-xxxxx.amazonaws.com"
      }
    }
  }
}
```
Auth methods (priority order):
1. `AWS_BEARER_TOKEN_BEDROCK` env var or `/connect` token
2. `AWS_PROFILE` / `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`
3. Instance metadata / EKS IRSA

### Azure OpenAI
```jsonc
{
  "provider": {
    "azure": {
      "options": {
        "resourceName": "{env:AZURE_RESOURCE_NAME}"
      }
    }
  }
}
```
Requires `AZURE_RESOURCE_NAME` env var + API key via `/connect`.

### GitHub Copilot
Auth: Run `/connect` → GitHub Copilot → device code at `github.com/login/device`. Some models require Pro+ subscription.

### Google Vertex AI
```jsonc
{
  "provider": {
    "vertex": {
      "options": {
        "project": "{env:GOOGLE_CLOUD_PROJECT}",
        "location": "global"
      }
    }
  }
}
```
Requires `GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth`. Use `global` region for best availability.

### Ollama (local)
```jsonc
{
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": {
        "baseURL": "http://localhost:11434/v1"
      },
      "models": {
        "llama3": { "name": "Llama 3" }
      }
    }
  }
}
```
For tool calling, increase `num_ctx` to 16k-32k in Ollama.

### OpenRouter
```jsonc
{
  "provider": {
    "openrouter": {
      "options": {
        "timeout": 600000
      }
    }
  }
}
```
Auth: API key via `/connect` or `OPENROUTER_API_KEY`.

### DeepSeek
Auth: API key from [platform.deepseek.com](https://platform.deepseek.com) via `/connect`.

### Cloudflare AI Gateway
```jsonc
{
  "provider": {
    "cloudflare-ai-gateway": {
      "options": {
        "baseURL": "https://gateway.ai.cloudflare.com/v1/{accountId}/{gatewayId}"
      },
      "models": {
        "openai/gpt-4o": {},
        "anthropic/claude-sonnet-4": {}
      }
    }
  }
}
```
Requires `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_GATEWAY_ID`, and `CLOUDFLARE_API_TOKEN`.

### GitLab Duo (experimental)
```jsonc
{
  "provider": {
    "gitlab": {
      "options": {
        "instanceUrl": "https://gitlab.com"
      }
    }
  }
}
```
Auth: OAuth (recommended) or Personal Access Token with `api` scope. Requires Premium/Ultimate subscription.

### DigitalOcean
Auth: OAuth (recommended, auto-discovers Inference Routers) or Model Access Key.

### Other Providers (all via `/connect`)
Cerebras, Groq, Fireworks AI, Deep Infra, Hugging Face, Moonshot AI (Kimi), MiniMax, NVIDIA, Nebius, Baseten, 302.AI, IO.NET, Cortecs, FrogBot, Helicone, Cloudflare Workers AI.

## Local Model Pattern

All local/OpenAI-compatible providers follow this pattern:

```jsonc
{
  "provider": {
    "<provider-id>": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "<Display Name>",
      "options": { "baseURL": "<endpoint>" },
      "models": {
        "<model-id>": {
          "name": "<Display Name>",
          "limit": { "context": 128000, "output": 65536 }
        }
      }
    }
  }
}
```

Compatible tools: Ollama, LM Studio, llama.cpp, Atomic Chat, and any OpenAI-compatible endpoint.
