"""QoderReviewAdapter — integrates with Qoder CodeReview for automated code review.

Responsible for:
  - Sending code diffs to Qoder CodeReview
  - Receiving review report (quality, issues, suggestions)
"""

from __future__ import annotations

import logging
from typing import Any

from dagent_agent.config import settings

logger = logging.getLogger(__name__)


class QoderReviewAdapter:
    """Adapter for the Qoder CodeReview API."""

    def __init__(self, base_url: str = "", api_key: str = "") -> None:
        self._base_url = base_url or settings.qoder_api_base_url
        self._api_key = api_key or settings.qoder_api_key

    async def review_code(self, diffs: str, codebase_context: str = "") -> dict[str, Any]:
        """Send diffs to Qoder CodeReview and return the review report.

        Returns dict with keys: ``approved`` (bool), ``issues`` (list), ``summary`` (str).
        """
        # TODO: implement actual Qoder CodeReview API call
        logger.info("QoderReviewAdapter.review_code called (diffs length=%d)", len(diffs))
        return {
            "approved": False,
            "issues": [],
            "summary": "stub — review not yet implemented",
        }
