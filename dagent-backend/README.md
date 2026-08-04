# Dagent Backend

FastAPI backend for the Dagent v2.2 P0 workflow. The implementation covers authentication, tenant and project
authorization, project/repository binding, requirement lifecycle, immutable artifacts, clarification rounds, the three
human review gates, two reusable main Agent sessions, Agent task tracking, audit logs, and the v2.2 state machine.

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
Copy-Item .env.example .env
.\.venv\Scripts\uvicorn.exe dagent.app:create_app --factory --reload --port 8000
```

The default SQLite configuration seeds four local users: `admin/admin123`, `pm/pm123`,
`developer/developer123`, and `qa/qa123`. Set `SEED_DEMO_DATA=false` outside local development.

OpenAPI is available at `http://localhost:8000/docs`.

## Agent result contract

Agent work is persisted as a queued task. Dagent only advances a stage after the Agent service reports a result to:

```text
POST /api/v1/internal/agent-tasks/{task_id}/result
Authorization: Bearer <AGENT_CALLBACK_TOKEN>
```

This callback is intentionally separate from user authentication. It must be protected by an internal service token
and private network policy in deployed environments. A missing OpenCode/Agent worker therefore leaves the task queued;
the backend never fabricates a successful result.

The development Agent runs only the smallest relevant unit test and one smoke check. A successful implementation
callback must include both a development report and non-empty manual test cases. There is no testing Agent or testing
task; human testers execute the generated cases before final acceptance.

## Checks

```powershell
.\.venv\Scripts\python.exe -m ruff check dagent tests
.\.venv\Scripts\python.exe -m mypy dagent
.\.venv\Scripts\python.exe -m pytest -q
```
