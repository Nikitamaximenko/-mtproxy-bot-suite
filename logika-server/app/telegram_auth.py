from __future__ import annotations

import hashlib
import hmac
import time

from app.config import Settings


def verify_telegram_login(payload: dict[str, str], settings: Settings) -> None:
    """
    Проверка подписи Telegram Login Widget:
    https://core.telegram.org/widgets/login#checking-authorization
    """
    if not settings.telegram_bot_token:
        raise ValueError("Telegram login не настроен: отсутствует TELEGRAM_BOT_TOKEN")

    tg_hash = (payload.get("hash") or "").strip()
    if not tg_hash:
        raise ValueError("Telegram login: отсутствует hash")

    auth_date_raw = (payload.get("auth_date") or "").strip()
    if not auth_date_raw.isdigit():
        raise ValueError("Telegram login: некорректный auth_date")
    auth_date = int(auth_date_raw)
    # Окно доверия 15 минут.
    if abs(int(time.time()) - auth_date) > 15 * 60:
        raise ValueError("Telegram login: auth_date слишком старый")

    check_items = []
    for k, v in payload.items():
        if k == "hash" or v is None:
            continue
        check_items.append(f"{k}={v}")
    data_check_string = "\n".join(sorted(check_items))

    secret_key = hashlib.sha256(settings.telegram_bot_token.encode()).digest()
    calc_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calc_hash, tg_hash):
        raise ValueError("Telegram login: hash mismatch")
