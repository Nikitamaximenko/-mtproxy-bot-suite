from __future__ import annotations

import re


def normalize_ru_phone(raw: str) -> str:
    """
    Возвращает 11 цифр 79XXXXXXXXX или ValueError.
    """
    s = re.sub(r"\D+", "", (raw or "").strip())
    if s.startswith("8") and len(s) == 11:
        s = "7" + s[1:]
    if s.startswith("9") and len(s) == 10:
        s = "7" + s
    if len(s) != 11 or not s.startswith("7"):
        raise ValueError("Нужен номер РФ в формате +7…")
    return s


def to_e164(digits_11: str) -> str:
    return f"+{digits_11}"
