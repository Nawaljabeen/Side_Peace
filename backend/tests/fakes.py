"""Test doubles for the LLM provider. Tests never call a real LLM (cost, speed, flakiness: R-02)."""
from errors import ProviderBadResponseError, ProviderRateLimitError, ProviderTimeoutError
from services.llm_provider import AbstractLLMProvider


class FakeProvider(AbstractLLMProvider):
    """Returns a canned answer and remembers every prompt it was given."""

    def __init__(self, answer: str = "fake answer") -> None:
        self.answer = answer
        self.prompts: list[str] = []

    async def generate_response(self, prompt: str) -> str:
        self.prompts.append(prompt)
        return self.answer


class TimeoutProvider(AbstractLLMProvider):
    async def generate_response(self, prompt: str) -> str:
        raise ProviderTimeoutError("simulated timeout")


class RateLimitProvider(AbstractLLMProvider):
    async def generate_response(self, prompt: str) -> str:
        raise ProviderRateLimitError("simulated rate limit")


class BadResponseProvider(AbstractLLMProvider):
    async def generate_response(self, prompt: str) -> str:
        raise ProviderBadResponseError("simulated bad response")


class CrashingProvider(AbstractLLMProvider):
    """Simulates a bug: raises something that is not a SidePeaceError."""

    async def generate_response(self, prompt: str) -> str:
        raise RuntimeError("simulated crash with a secret detail")