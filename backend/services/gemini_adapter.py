"""GeminiAdapter (Adapter pattern): our neutral generate_response(prompt) <-> Google's REST format.

All Google-specific shapes and errors stay in this file. Failures become our typed errors.
The API key travels only in the x-goog-api-key header and is never logged or put in a message.
"""
import logging

import httpx

from errors import ProviderBadResponseError, ProviderRateLimitError, ProviderTimeoutError
from services.llm_provider import AbstractLLMProvider

logger = logging.getLogger("sidepeace")

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_TIMEOUT_SECONDS = 20.0


class GeminiAdapter(AbstractLLMProvider):
    def __init__(
        self,
        api_key: str,
        model: str,
        client: httpx.AsyncClient | None = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        if not api_key:
            raise ValueError("api_key must not be empty")
        self._api_key = api_key
        self._model = model
        self._client = client or httpx.AsyncClient(timeout=timeout_seconds)

    async def generate_response(self, prompt: str) -> str:
        url = f"{BASE_URL}/models/{self._model}:generateContent"
        body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
        try:
            response = await self._client.post(url, json=body, headers={"x-goog-api-key": self._api_key})
        except httpx.TimeoutException as exc:
            logger.warning("gemini request timed out")
            raise ProviderTimeoutError("the provider timed out") from exc
        except httpx.HTTPError as exc:
            logger.warning("gemini request failed: %s", type(exc).__name__)
            raise ProviderBadResponseError("the provider could not be reached") from exc

        if response.status_code == 429:
            logger.warning("gemini rate limit reached")
            raise ProviderRateLimitError("the provider rate limit was reached")
        if response.status_code >= 400:
            logger.warning("gemini returned status %s", response.status_code)
            raise ProviderBadResponseError("the provider rejected the request")
        return self._extract_text(response)

    async def aclose(self) -> None:
        await self._client.aclose()

    @staticmethod
    def _extract_text(response: httpx.Response) -> str:
        try:
            parts = response.json()["candidates"][0]["content"]["parts"]
            text = "".join(part.get("text", "") for part in parts)
        except (ValueError, KeyError, IndexError, TypeError, AttributeError) as exc:
            raise ProviderBadResponseError("the provider response had an unexpected shape") from exc
        if not text.strip():
            raise ProviderBadResponseError("the provider returned an empty answer")
        return text