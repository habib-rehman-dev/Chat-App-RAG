from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


# 1. Represents individual message parts (text, images, etc.)
class MessagePart(BaseModel):
    type: str = "text"
    text: str | None = ""


# 2. Represents a single message item sent from the frontend
class MessageItem(BaseModel):
    id: str | None = None
    role: Literal["user", "assistant", "system"] = "user"
    content: str | None = None
    parts: list[MessagePart] | None = None


# 3. Main payload sent to the POST /chat endpoint
class ChatRequest(BaseModel):
    session_id: UUID | None = Field(
        default=None,
        description="If None, a new chat session will be created. If provided, appends to existing session.",
    )
    messages: list[MessageItem] = Field(..., min_length=1,description="The message history or current prompt sent from the frontend.")

    # Helper method to reliably extract the latest user prompt
    def get_latest_user_prompt(self) -> str:
        if not self.messages:
            return ""

        last = self.messages[-1]

        # 1. Check direct content string
        if last.content and last.content.strip():
            return last.content.strip()

        # 2. Check parts array
        if last.parts:
            text_parts = [p.text for p in last.parts if p.type == "text" and p.text]
            if text_parts:
                return "".join(text_parts).strip()

        return ""
