from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


def _database_url() -> str:
    raw = (os.getenv("DATABASE_URL") or "").strip()
    if not raw:
        return "sqlite:///./logika.db"
    # Railway / Heroku sometimes pass postgres:// — SQLAlchemy wants postgresql://
    if raw.startswith("postgres://"):
        raw = "postgresql+psycopg2://" + raw[len("postgres://") :]
    elif raw.startswith("postgresql://") and "+psycopg2" not in raw.split("://", 1)[0]:
        raw = "postgresql+psycopg2://" + raw[len("postgresql://") :]
    return raw


DATABASE_URL = _database_url()

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
