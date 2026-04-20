from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.config import Settings


def hash_otp(settings: Settings, subject: str, code: str) -> str:
    """subject: стабильная строка канала, напр. «p:7999…» или «e:user@domain.ru»."""
    msg = f"{subject}:{code}".encode()
    return hmac.new(settings.jwt_secret.encode(), msg, hashlib.sha256).hexdigest()


def random_digits(n: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(n))


def create_access_token(settings: Settings, user_id: uuid.UUID) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=30)
    return jwt.encode(
        {"sub": str(user_id), "exp": exp},
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_token(settings: Settings, token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        sub = payload.get("sub")
        if not sub:
            raise ValueError("no sub")
        return uuid.UUID(sub)
    except Exception as e:
        raise ValueError("invalid token") from e
