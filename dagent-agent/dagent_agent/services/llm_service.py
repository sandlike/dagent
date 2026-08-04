"""LLMService — unified LLM call wrapper.

Supports DeepSeek Chat (default) and other OpenAI-compatible APIs.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from dagent_agent.config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """Thin wrapper around OpenAI-compatible chat completion endpoints."""

    def __init__(self, base_url: str = "", api_key: str = "") -> None:
        self._base_url = base_url or settings.llm_api_base_url
        self._api_key = api_key or settings.llm_api_key

    async def chat(
        self,
        prompt: str,
        model: str = "",
        system_prompt: str = "You are a senior software engineer assisting with requirement analysis and code generation.",
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """Send a chat completion request and return the assistant's reply text."""
        model = model or settings.llm_model
        temperature = temperature if temperature is not None else settings.llm_temperature
        max_tokens = max_tokens or settings.llm_max_tokens

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        logger.debug("LLMService.chat model=%s prompt_len=%d", model, len(prompt))

        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{self._base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

        return data["choices"][0]["message"]["content"]
