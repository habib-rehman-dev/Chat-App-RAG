from llama_index.core.llms import ChatMessage, MessageRole

import json
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.core.database import SessionLocal, get_db
from src.core.security import CurrentUser, get_chat_user
from src.features.chat.agent import llm_stream
from src.features.chat.schema import ChatRequest
from src.features.chat.services import (
    get_or_create_session,
    get_session_messages,
    save_message,
)
from src.features.chat.services import get_sessions 

router = APIRouter()
logger = logging.getLogger(__name__)

CHAT_USER_DEPENDENCY = Depends(get_chat_user)
DB_DEPENDENCY = Depends(get_db)

# Vercel AI SDK v5+ requires this header to parse the UI Message Stream
UI_STREAM_HEADERS = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "x-vercel-ai-ui-message-stream": "v1",
    # If you hit CORS issues, uncomment:
    # "Access-Control-Allow-Origin": "*",
}


def _sse(payload: dict) -> str:
    """Serialize one UI Message Stream chunk as an SSE data line."""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _extract_prompt(messages) -> str:
    if not messages:
        return ""
    last = messages[-1]
    parts = getattr(last, "parts", None) or []
    return "".join(p.text for p in parts if getattr(p, "type", None) == "text").strip()




settings = get_settings()

@router.post("/chat")
async def chat(
    payload: ChatRequest,
    current_user: CurrentUser = CHAT_USER_DEPENDENCY,
    db: AsyncSession = DB_DEPENDENCY,
):
    prompt = _extract_prompt(payload.messages)
    if not prompt:
        raise HTTPException(status_code=400, detail="Empty message")

    logger.info("chat request user=%s prompt=%r", current_user.id, prompt)

    # 1. Resolve session (creates one if none provided)
    print(payload.session_id)
    chat_session = await get_or_create_session(
        db=db,
        user_id=current_user.id,
        session_id=str(payload.session_id) if payload.session_id else None,
        initial_title=prompt[:50],
    )

    # 2. Persist the user's message
    await save_message(db, chat_session.id, "user", prompt)

    # 3. Load prior history for context (excludes just-saved user msg? No — includes it.
    #    We strip the last one because we pass `prompt` separately.)
       # 3. Load prior history (excluding the user message we just saved).
    history_rows = await get_session_messages(db, chat_session.id)
    history_rows = history_rows[:-1]  # drop the user msg we just saved

    # Trim to the configured limit so long chats don't blow up the context.
    limit = settings.history_message_limit
    if limit and limit > 0:
        history_rows = history_rows[-limit:]

    # Convert DB rows -> LlamaIndex ChatMessages, preserving roles.
    llama_history = [
        ChatMessage(
            role=MessageRole.USER if row.role == "user" else MessageRole.ASSISTANT,
            content=row.content,
        )
        for row in history_rows
    ]
    session_id = chat_session.id
    message_id = f"msg_{uuid.uuid4().hex}"
    text_id = f"txt_{uuid.uuid4().hex}"

    # 4. Streaming generator
    async def event_stream() -> AsyncIterator[str]:
        buffer: list[str] = []
        # IMPORTANT: use a *fresh* session inside the generator.
        # The request-scoped `db` is closed as soon as the response starts.
        async with SessionLocal() as stream_db:
            try:
                yield _sse({"type": "start", "messageId": message_id})
                yield _sse({"type": "text-start", "id": text_id})

                async for delta in llm_stream(prompt, history=llama_history):
                    if not delta:
                        continue
                    buffer.append(delta)
                    yield _sse(
                        {"type": "text-delta", "id": text_id, "delta": delta}
                    )

                yield _sse({"type": "text-end", "id": text_id})
                yield _sse({"type": "finish"})

            except Exception as exc:  
                logger.exception("stream error: %s", exc)
                yield _sse(
                    {
                        "type": "error",
                        "errorText": "Something went wrong while generating the reply.",
                    }
                )
            finally:
                assistant_text = "".join(buffer).strip()
                if assistant_text:
                    try:
                        await save_message(
                            stream_db, session_id, "assistant", assistant_text
                        )
                    except Exception: 
                        logger.exception("failed to persist assistant message")

    return StreamingResponse(event_stream(), headers=UI_STREAM_HEADERS)






@router.get("/sessions")
async def get_user_sessions(
    current_user: CurrentUser = CHAT_USER_DEPENDENCY,
    db: AsyncSession = DB_DEPENDENCY,
):
    print("get_user_sessions called with user_id:", current_user.id)  # Debugging line
    sessions = await get_sessions(db , user_id=current_user.id)

    return sessions
    # print("get_user_sessions called")  # Debugging line



@router.get("/chat/sessions/{session_id}/messages")
async def get_session_messages_endpoint(
    session_id: str,
    current_user: CurrentUser = CHAT_USER_DEPENDENCY,
    db: AsyncSession = DB_DEPENDENCY,
):
    messages = await get_session_messages(db, session_id)
    return messages