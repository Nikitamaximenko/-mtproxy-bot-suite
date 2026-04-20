from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LogikaUser(Base):
    __tablename__ = "logika_users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    phone_e164: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, index=True)
    email_norm: Mapped[str | None] = mapped_column(String(320), unique=True, nullable=True, index=True)
    name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    sessions: Mapped[list["LogikaChatSession"]] = relationship(back_populates="user")


class LogikaOtpCode(Base):
    __tablename__ = "logika_otp_codes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    phone_e164: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    email_norm: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)
    code_hash: Mapped[str] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class LogikaChatSession(Base):
    __tablename__ = "logika_chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("logika_users.id"), index=True)
    dilemma: Mapped[str] = mapped_column(Text)
    # [{ "role": "user"|"assistant", "content": "..." }, ...]
    messages: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    phase: Mapped[str] = mapped_column(String(32), default="clarifying")  # clarifying | done
    report: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    user: Mapped["LogikaUser"] = relationship(back_populates="sessions")
