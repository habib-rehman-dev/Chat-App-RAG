
# src/models/chat.py
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base


class ChatSession(Base):
    """Represents a chat session between a user and the AI assistant."""

    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    title: Mapped[str] = mapped_column(
        String(255), nullable=False, default="New Chat"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ChatMessage(Base):
    """Represents a single message in a chat session."""

    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # 'user' | 'assistant' | 'system'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    session: Mapped["ChatSession"] = relationship(
        "ChatSession", back_populates="messages"
    )








# # 1

# from datetime import datetime

# from sqlalchemy import func
# from sqlalchemy.orm import Mapped, mapped_column, relationship

# from src.core.database import Base


# class ChatSession(Base):
#     """Represents a chat session between a user and the AI assistant."""
#     __tablename__ = "chat_sessions"

#     id: Mapped[str] = mapped_column(primary_key=True)
#     user_id: Mapped[str] = mapped_column(index=True)
#     title: Mapped[str] = mapped_column(length=255)
#     created_at: Mapped[datetime] = mapped_column(server_default=func.now())
#     updated_at: Mapped[datetime] = mapped_column(
#         server_default=func.now(), onupdate=func.now()
#     )

#     messages: Mapped[list["ChatMessage"]] = relationship(
#         "ChatMessage", back_populates="session", cascade="all, delete-orphan"
#     )



# class ChatMessage(Base):
#     """Represents a single message in a chat session."""

#     __tablename__ = "chat_messages"

#     id: Mapped[str] = mapped_column(primary_key=True)
#     session_id: Mapped[str] = mapped_column(
#         index=True, foreign_key="chat_sessions.id", nullable=False
#     )
#     role: Mapped[str] = mapped_column(length=50)
#     content: Mapped[str] = mapped_column()
#     created_at: Mapped[datetime] = mapped_column(server_default=func.now())

#     session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")



# 2

#     import uuid
# from datetime import datetime, timezone
# from sqlalchemy import Column, String, DateTime, ForeignKey, Text
# from sqlalchemy.dialects.postgresql import UUID
# from sqlalchemy.orm import relationship

# from src.core.database import Base # Adjust this import based on your SQLAlchemy setup

# class ChatSession(Base):
#     __tablename__ = "chat_sessions"

#     id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
#     user_id = Column(String(255), index=True, nullable=False) # Your Auth.js user ID
#     title = Column(String(255), default="New Chat")
#     created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
#     updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

#     messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


# class ChatMessage(Base):
#     __tablename__ = "chat_messages"

#     id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
#     session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
#     role = Column(String(50), nullable=False) # 'user', 'assistant', or 'system'
#     content = Column(Text, nullable=False)
#     created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

#     session = relationship("ChatSession", back_populates="messages")