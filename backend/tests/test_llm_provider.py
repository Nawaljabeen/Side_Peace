import pytest

from errors import ProviderTimeoutError
from services.llm_provider import AbstractLLMProvider
from tests.fakes import FakeProvider, TimeoutProvider


def test_abstract_provider_cannot_be_instantiated():
    with pytest.raises(TypeError):
        AbstractLLMProvider()


async def test_fake_provider_returns_its_answer_and_records_the_prompt():
    provider = FakeProvider("hello")

    assert await provider.generate_response("question?") == "hello"
    assert provider.prompts == ["question?"]


async def test_a_new_provider_needs_no_change_to_existing_code():
    """Open/Closed: this class is defined here, in the test, and works wherever a provider is expected."""

    class EchoProvider(AbstractLLMProvider):
        async def generate_response(self, prompt: str) -> str:
            return prompt

    provider: AbstractLLMProvider = EchoProvider()

    assert await provider.generate_response("same") == "same"


async def test_fault_injecting_provider_raises_a_typed_error():
    with pytest.raises(ProviderTimeoutError):
        await TimeoutProvider().generate_response("anything")