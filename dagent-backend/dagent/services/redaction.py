from __future__ import annotations

import re
from collections.abc import Iterable


def redact_sensitive_text(value: str, secrets: Iterable[str] = ()) -> str:
    redacted = value
    for secret in secrets:
        if secret:
            redacted = redacted.replace(secret, "<redacted>")
    redacted = re.sub(r"https?://[^\s/@:]+:[^\s/@]+@", "https://<redacted>@", redacted)
    return re.sub(
        r"(?i)(token|password|secret|api[_-]?key)(\s*[=:]\s*)([^\s]+)",
        r"\1\2<redacted>",
        redacted,
    )
