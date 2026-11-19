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
