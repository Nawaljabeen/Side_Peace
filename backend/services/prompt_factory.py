"""PromptFactory: builds the isolated side-kick prompt (simple factory, not a GoF pattern)."""
from services.models import Turn

MAX_QUESTION_LENGTH = 2000

_TEMPLATE = (
    "You are a side-kick assistant. Answer the side question below directly. The earlier "
    "conversation is context you may use when it helps; if the question is not about it, "
    "answer from your general knowledge. Do not say the conversation lacks the answer and "
    "do not continue the main conversation.\n\n"
    "Earlier conversation:\n{history}\n\nSide question: {question}"
)


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
        return _TEMPLATE.format(history=history, question=question)
