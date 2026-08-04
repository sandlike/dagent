# Dagent Agent Service

AI-driven agent service for the Dagent platform — handles requirement analysis, clarification, proposal generation, code generation (via Qoder), and automated testing.

## Architecture

```
dagent_agent/
├── agents/          # BaseAgent + concrete agents (Analysis, Clarification, Proposal, Test)
├── adapters/        # External integrations (Qoder Coding, Qoder CodeReview)
├── services/        # Shared services (LLM, Codebase, Document)
├── skills/          # Reusable capabilities (CodebaseReader)
└── config.py        # pydantic-settings configuration
```

## Quick Start

```bash
# Install dependencies
pip install -e ".[dev]"

# Run tests
make test

# Lint
make lint
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DAGENT_LLM_API_BASE_URL` | LLM API base URL |
| `DAGENT_LLM_API_KEY` | LLM API key |
| `DAGENT_LLM_MODEL` | LLM model name (default: deepseek-chat) |
| `DAGENT_QODER_API_BASE_URL` | Qoder API base URL |
| `DAGENT_QODER_API_KEY` | Qoder API key |
