"""CodebaseReaderSkill — read and extract context from a code repository.

Used by agents to:
  - List directory structure
  - Read specific files
  - Extract class / function signatures
  - Identify module boundaries
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class CodebaseReaderSkill:
    """Read source code from a local repository clone and return structured info."""

    def __init__(self, max_depth: int = 3, max_file_size: int = 50_000) -> None:
        self._max_depth = max_depth
        self._max_file_size = max_file_size

    def list_tree(self, root: str, depth: int = 0) -> list[dict[str, Any]]:
        """Return a tree representation of the directory structure."""
        if depth >= self._max_depth:
            return []

        entries: list[dict[str, Any]] = []
        try:
            for item in sorted(Path(root).iterdir()):
                if item.name.startswith(".") or item.name in ("node_modules", "__pycache__", ".venv"):
                    continue
                entry: dict[str, Any] = {"name": item.name, "type": "dir" if item.is_dir() else "file"}
                if item.is_dir():
                    entry["children"] = self.list_tree(str(item), depth + 1)
                entries.append(entry)
        except PermissionError:
            logger.warning("permission denied reading %s", root)

        return entries

    def read_file(self, filepath: str) -> str:
        """Read a single file, truncated to max_file_size."""
        path = Path(filepath)
        if not path.is_file():
            return ""
        text = path.read_text(errors="replace")
        if len(text) > self._max_file_size:
            text = text[: self._max_file_size] + "\n... (truncated)"
        return text
