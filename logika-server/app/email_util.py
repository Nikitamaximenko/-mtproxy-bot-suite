"""Нормализация email для OTP и аккаунта."""

from __future__ import annotations


def normalize_email(raw: str) -> str:
    s = (raw or "").strip().lower()
    if len(s) < 5 or "@" not in s:
        raise ValueError("Некорректный email")
    local, _, domain = s.partition("@")
    if not local or not domain or "." not in domain:
        raise ValueError("Некорректный email")
    if len(local) > 64 or len(domain) > 255:
        raise ValueError("Некорректный email")
    return s
