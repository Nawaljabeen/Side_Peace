"""AbstractLLMProvider: the only thing the rest of the backend knows about an LLM (Dependency Inversion).

A new provider is a new subclass; the routers do not change (Open/Closed). The prompt is complete
(PromptFactory already put the context and the question in it), so no history is passed separately.
Implementations raise ProviderTimeoutError, ProviderRateLimitError or ProviderBadResponseError.
"""
from abc import ABC, abstractmethod


class AbstractLLMProvider(ABC):
    @abstractmethod
    async def generate_response(self, prompt: str) -> str:
        """Return the model's answer text for this prompt."""