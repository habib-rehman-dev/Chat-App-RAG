










from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.features.chat.models import ChatMessage, ChatSession


async def get_or_create_session(
    db: AsyncSession,
    user_id: str,
    session_id: str | None,
    initial_title: str,
) -> ChatSession:
    if session_id:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            return existing

    new_session = ChatSession(
        id=str(uuid4()),
        user_id=user_id,
        title=initial_title[:255],
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session


async def save_message(
    db: AsyncSession,
    session_id: str,
    role: str,
    content: str,
) -> ChatMessage:
    msg = ChatMessage(
        id=str(uuid4()),
        session_id=session_id,
        role=role,
        content=content,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def get_session_messages(
    db: AsyncSession,
    session_id: str,
) -> list[ChatMessage]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return list(result.scalars().all())

async def get_sessions(
    db: AsyncSession,
    user_id: str,
) -> list[ChatSession]:
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.created_at.desc())
    )
    return list(result.scalars().all())

# async def get_message_by_id(
#     db: AsyncSession,
#     message_id: str,
# ) -> ChatMessage | None:
#     result = await db.execute(
#         select(ChatMessage).where(ChatMessage.id == message_id)
#     )
#     return result.scalar_one_or_none()