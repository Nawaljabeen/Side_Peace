"""Unit tests for PromptFactory (REQ-F02: isolated side-kick prompt)."""
import pytest

from services.models import Turn
from services.prompt_factory import MAX_QUESTION_LENGTH, PromptFactory


def test_prompt_contains_context_turns_and_question():
    context = [Turn(0, "user", "What is a mutex?"), Turn(1, "model", "A lock for shared data.")]
    prompt = PromptFactory.build_sidekick_prompt(context, "Why does it matter?")
    assert "What is a mutex?" in prompt
    assert "A lock for shared data." in prompt
    assert "Why does it matter?" in prompt


def test_empty_context_still_produces_a_prompt_with_the_question():
    prompt = PromptFactory.build_sidekick_prompt([], "What is a mutex?")
    assert "What is a mutex?" in prompt
    assert "no previous conversation" in prompt.lower()


@pytest.mark.parametrize("question", ["", "   "])
def test_blank_question_is_rejected(question):
    with pytest.raises(ValueError):
        PromptFactory.build_sidekick_prompt([], question)


def test_question_longer_than_limit_is_rejected():
    with pytest.raises(ValueError):
        PromptFactory.build_sidekick_prompt([], "x" * (MAX_QUESTION_LENGTH + 1))


def test_question_exactly_at_limit_is_accepted():
    prompt = PromptFactory.build_sidekick_prompt([], "x" * MAX_QUESTION_LENGTH)
    assert "x" * MAX_QUESTION_LENGTH in prompt


def test_prompt_marks_side_question_as_isolated_and_has_no_secrets():
    prompt = PromptFactory.build_sidekick_prompt([], "hi")
    assert "side question" in prompt.lower()
    for forbidden in ("api_key", "apikey", "secret", "password", "token="):
        assert forbidden not in prompt.lower()


def test_prompt_lets_the_model_use_general_knowledge_when_the_chat_has_no_answer():
    # CAPA-04: with the real Gemini the old wording made it refuse ("there is no mention of ... in the conversation").
    prompt = PromptFactory.build_sidekick_prompt([], "What is a semaphore?").lower()
    assert "general knowledge" in prompt
    assert "only as background" not in prompt
