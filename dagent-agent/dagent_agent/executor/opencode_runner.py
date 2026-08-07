"""OpencodeRunner — invoke opencode (non-interactive) and parse its JSON output.

opencode is the required agent runtime. We drive it via `opencode run --format json`,
which streams one JSON event per line. We collect every text part to reconstruct
the assistant's final reply.

Read-only permissions are enforced in the global opencode config so the agent can
explore the codebase but never modify it or run shell commands.
"""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
from pathlib import Path

from dagent_agent.config import settings

logger = logging.getLogger(__name__)

# Directory shipped with this package: agents/, skills/, opencode.jsonc template
_PACKAGE_OPENCODE_DIR = Path(__file__).resolve().parent.parent.parent / "opencode"
_GLOBAL_CONFIG_DIR = Path.home() / ".config" / "opencode"


class OpencodeRunner:
    """Run opencode for a single task and return the assistant's text reply."""

    def __init__(self) -> None:
        self._model = settings.llm_model
        self._ensure_config()

    def _ensure_config(self) -> None:
        """Write the global opencode config (provider/model/permissions) and copy
        the packaged agents + skills into ~/.config/opencode/."""
        _GLOBAL_CONFIG_DIR.mkdir(parents=True, exist_ok=True)

        # Provider config — values come from settings (sourced from .env),
        # so no secrets are committed to the repo.
        provider_id = "zhipu"
        config = {
            "$schema": "https://opencode.ai/config.json",
            "provider": {
                provider_id: {
                    "name": "LLM",
                    "options": {
                        "baseURL": settings.llm_api_base_url,
                        "apiKey": settings.llm_api_key,
                    },
                    "models": {
                        settings.llm_model: {"name": settings.llm_model},
                    },
                }
            },
            "model": f"{provider_id}/{settings.llm_model}",
            "permission": {
                "edit": "deny",
                "bash": "deny",
                "read": "allow",
                "grep": "allow",
                "glob": "allow",
                "external_directory": "deny",
            },
        }

        # Serena MCP — semantic codebase understanding via LSP. Configured only
        # when the `serena` CLI is on PATH so dev environments without it silently
        # fall back to built-in read tools (non-breaking: absent → no MCP config).
        serena_bin = shutil.which("serena")
        if serena_bin:
            config["mcp"] = {
                "serena": {
                    "type": "local",
                    # `--context ide` is Serena's recommended context for
                    # terminal-based clients (reduces tool overlap with opencode's
                    # built-in read/grep/glob). `--project-from-cwd` makes Serena
                    # index the repo opencode is running in (set by --dir in run()).
                    "command": [
                        serena_bin,
                        "start-mcp-server",
                        "--context", "ide",
                        "--project-from-cwd",
                    ],
                    "enabled": True,
                    # Serena starts a language server and indexes on startup;
                    # 30s is generous for medium repos.
                    "timeout": 30000,
                },
            }
            # Safety: hide Serena's write/edit/execute tools from the agent
            # entirely. opencode's edit:deny + bash:deny already blocks built-in
            # write tools; this ensures Serena's MCP-level tools are also gone.
            config["tools"] = {
                "serena__replace_symbol_body": False,
                "serena__insert_after_symbol": False,
                "serena__insert_before_symbol": False,
                "serena__safe_delete": False,
                "serena__rename_symbol": False,
                "serena__replace_content": False,
                "serena__execute_shell_command": False,
            }
            # Pre-create Serena's config dir and write a read-only safety config
            # if one doesn't exist yet (e.g. in Docker where `serena init` wasn't
            # run during build). If `serena init` already created the config, we
            # leave it untouched so user customisations are preserved.
            serena_dir = Path.home() / ".serena"
            serena_dir.mkdir(parents=True, exist_ok=True)
            serena_config = serena_dir / "serena_config.yml"
            if not serena_config.exists():
                serena_config.write_text(
                    "language_backend: LSP\n"
                    "web_dashboard: false\n"
                    "web_dashboard_open_on_launch: false\n"
                    "excluded_tools:\n"
                    "- replace_symbol_body\n"
                    "- insert_after_symbol\n"
                    "- insert_before_symbol\n"
                    "- safe_delete\n"
                    "- rename_symbol\n"
                    "- replace_content\n"
                    "- execute_shell_command\n"
                )
                logger.info("Wrote minimal read-only Serena config to %s", serena_config)
            logger.info("Serena MCP enabled (serena CLI at %s)", serena_bin)
        else:
            logger.info(
                "Serena CLI not found on PATH — running without Serena MCP "
                "(agent will use built-in read/grep/glob tools only)"
            )

        config_path = _GLOBAL_CONFIG_DIR / "opencode.jsonc"
        config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False))

        # Copy packaged agents + skills (merge into the global config dir).
        for sub in ("agents", "skills"):
            src = _PACKAGE_OPENCODE_DIR / sub
            dst = _GLOBAL_CONFIG_DIR / sub
            if src.exists():
                dst.mkdir(parents=True, exist_ok=True)
                for item in src.rglob("*"):
                    if item.is_file():
                        rel = item.relative_to(src)
                        target = dst / rel
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(item, target)

        logger.info("opencode config written to %s", config_path)

    async def run(self, prompt: str, cwd: str, timeout: int | None = None) -> str:
        """Run opencode non-interactively in *cwd* and return the assistant text.

        ``--dir`` is passed explicitly because `opencode run` does NOT infer the
        project from the process cwd — it falls back to the global/last-used
        project, which could be an unrelated directory on this host. Forcing
        ``--dir`` to the bound-repo clone confines the agent to that repository
        so it cannot read the host's other code (the ``external_directory: deny``
        permission then blocks anything outside it)."""
        timeout = timeout or settings.agent_timeout_seconds
        process = await asyncio.create_subprocess_exec(
            "opencode",
            "run",
            "--format",
            "json",
            "--auto",
            "--dir",
            cwd,
            prompt,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
        except TimeoutError:
            process.kill()
            await process.communicate()
            raise RuntimeError(f"opencode timed out after {timeout}s")

        if process.returncode != 0:
            detail = stderr.decode("utf-8", errors="replace").strip()[:1000]
            raise RuntimeError(f"opencode exited {process.returncode}: {detail}")

        return self._extract_text(stdout.decode("utf-8", errors="replace"))

    @staticmethod
    def _extract_text(output: str) -> str:
        """Concatenate every `text` part from the JSON event stream."""
        parts: list[str] = []
        for line in output.splitlines():
            line = line.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("type") == "text":
                part = event.get("part") or {}
                text = part.get("text")
                if text:
                    parts.append(text)
        return "".join(parts)
