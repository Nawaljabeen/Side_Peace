"""PromptFactory: builds the isolated side-kick prompt (simple factory, not a GoF pattern)."""
from services.models import Turn

MAX_QUESTION_LENGTH = 2000


class PromptFactory:
    @staticmethod
    def build_sidekick_prompt(context: list[Turn], question: str) -> str:
        if not question.strip():
            raise ValueError("question must not be blank")
        if len(question) > MAX_QUESTION_LENGTH:
            raise ValueError(f"question must be at most {MAX_QUESTION_LENGTH} characters")
        if context:
            history = "\n".join(f"{turn.role}: {turn.text}" for turn in context)
        else:
            history = "(no previous conversation)"
        return f"{history}\n\nQuestion: {question}"
