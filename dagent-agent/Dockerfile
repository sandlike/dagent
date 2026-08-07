# dagent-agent runtime image.
#
# Runs the dagent-agent polling executor inside a container. Designed for the
# per-requirement container model: a K8s Job launches one Pod per requirement
# with `args: ["--requirement-id", "<id>"]`; the agent processes that
# requirement's current task(s) and exits at a human gate, then the Job
# completes and the Pod is reclaimed.
#
# Without args it falls back to the long-lived polling loop (all pending
# tasks), which is the shared-service deployment alternative.
#
# Runtime secrets (NOT baked into this image — inject via K8s Secret):
#   - DAGENT_BACKEND_API_BASE_URL  e.g. http://dagent-backend:8000
#   - DAGENT_AGENT_CALLBACK_TOKEN  backend callback auth token
#   - DAGENT_LLM_API_BASE_URL / DAGENT_LLM_API_KEY / DAGENT_LLM_MODEL
#   - DAGENT_CODEBASE_WORK_DIR      writable path for git clones (PVC or emptyDir)
#   - /home/dagent/.ssh/*          SSH key + config for cloning private repos

FROM python:3.11-slim-bookworm AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build
COPY pyproject.toml ./
COPY dagent_agent ./dagent_agent
# Build wheels for the package's declared dependencies only; the package
# source itself is copied at runtime (see final stage) so that the opencode/
# sibling directory — which lives OUTSIDE the python package — resolves
# correctly via opencode_runner.py's Path(__file__).parent.parent.parent.
RUN python -m pip wheel --wheel-dir /wheels .

FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

# git + ca-certs + ssh client: CodebaseService shells out to `git clone` over
# SSH. opencode-ai ships a pre-built ELF binary, but it may dynamically link
# against libstdc++6 — installing it here avoids a runtime crash.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        ca-certificates \
        openssh-client \
        libstdc++6 \
        nodejs \
        npm \
    && rm -rf /var/lib/apt/lists/*

# opencode CLI (opencode_runner.py invokes `opencode run ...`). Pinned to the
# version currently used in dev to keep behaviour aligned; bump deliberately.
RUN npm install -g opencode-ai@1.18.11

# Serena MCP — semantic codebase understanding via LSP. uv manages its own
# Python 3.13 isolated env; the `serena` CLI is symlinked to /usr/local/bin
# so it's on PATH for the non-root runtime user. opencode_runner.py checks
# for `serena` at startup and configures the MCP server only when present
# (absent → built-in read tools only — non-breaking).
RUN pip install uv \
    && uv tool install -p 3.13 serena-agent \
    && ln -s /root/.local/bin/serena /usr/local/bin/serena

# Non-root user — the backend image uses uid 10001 too; keep them consistent
# so PVC ownership and Secret mounts line up across the namespace.
RUN groupadd --gid 10001 dagent \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin dagent

WORKDIR /app

# Install the runtime dependencies built in the builder stage.
COPY --from=builder /wheels /wheels
RUN python -m pip install /wheels/* && rm -rf /wheels

# Copy the package source and the opencode sibling directory (agents + skills
# markdown). opencode_runner.py copies these into ~/.config/opencode/ at
# startup, so they must live at /app/opencode relative to the package at
# /app/dagent_agent.
COPY dagent_agent ./dagent_agent
COPY opencode ./opencode

# Pre-create the runtime config dir so a non-root user can write to it.
RUN mkdir -p /home/dagent/.config/opencode /home/dagent/.ssh /home/dagent/.serena \
    && chown -R 10001:10001 /app /home/dagent

USER 10001:10001

# Default: long-lived polling loop. Override `args` in the K8s Job spec to
# run single-requirement mode, e.g.:
#   args: ["--requirement-id", "42"]
CMD ["python", "-m", "dagent_agent"]
