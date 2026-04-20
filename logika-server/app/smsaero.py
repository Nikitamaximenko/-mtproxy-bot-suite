"""SMS Aero HTTP API v2.

Документация: https://smsaero.ru/integration/documentation/api/
Логика запросов согласована с официальным клиентом (gate, POST JSON, разбор ответа).
"""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote_plus

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

# Зеркала шлюза (как в официальном Python-клиенте SMS Aero)
GATE_HOSTS = (
    "gate.smsaero.ru",
    "gate.smsaero.org",
    "gate.smsaero.net",
)

USER_AGENT = "LogikaServer/1.0 (+https://smsaero.ru/integration/documentation/api/)"

# Таймаут как в типичных примерах клиента (сек.)
HTTP_TIMEOUT = 30.0


def _build_v2_url(email: str, api_key: str, host: str, selector: str) -> str:
    """URL вида https://email:api_key@host/v2/<selector> (email и ключ кодируются для URL)."""
    user = quote_plus(email)
    key = quote_plus(api_key)
    sel = selector.lstrip("/")
    return f"https://{user}:{key}@{host}/v2/{sel}"


def _check_sms_api_response(data: dict[str, Any]) -> dict[str, Any] | None:
    """
    Разбор тела ответа v2: success, result, message, data.
    При успехе возвращает объект data (если есть), иначе None.
    """
    if data.get("result") == "no credits":
        raise RuntimeError("SMS Aero: недостаточно средств на счёте")
    if data.get("result") == "reject":
        reason = data.get("reason") or data.get("message")
        raise RuntimeError(reason or "SMS Aero: отправка отклонена")
    if not data.get("success"):
        raise RuntimeError(data.get("message") or str(data))
    raw = data.get("data")
    if isinstance(raw, dict):
        return raw
    return None


async def send_otp_sms(settings: Settings, phone_digits: str, code: str) -> None:
    if not settings.smsaero_email or not settings.smsaero_api_key:
        if settings.smsaero_allow_log_only:
            logger.warning("SMS Aero не настроен — код только в логах (SMSAERO_ALLOW_LOG_ONLY)")
            logger.info("OTP для %s: %s", phone_digits, code)
            return
        raise RuntimeError(
            "SMS не настроен: задайте SMSAERO_EMAIL и SMSAERO_API_KEY в Railway "
            "(или только для локалки SMSAERO_ALLOW_LOG_ONLY=true)",
        )

    text = f"Код входа Логика: {code}"
    payload: dict[str, Any] = {
        "number": int(phone_digits),
        "text": text,
        "sign": settings.smsaero_sign,
    }

    selector = "sms/testsend" if settings.smsaero_test_mode else "sms/send"

    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

    last_err: Exception | None = None
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers=headers) as client:
        for host in GATE_HOSTS:
            url = _build_v2_url(settings.smsaero_email, settings.smsaero_api_key, host, selector)
            try:
                r = await client.post(url, json=payload)
                try:
                    data = r.json()
                except ValueError as e:
                    raise RuntimeError(f"SMS Aero: не JSON в ответе (HTTP {r.status_code})") from e

                if not isinstance(data, dict):
                    if r.is_error:
                        r.raise_for_status()
                    raise RuntimeError(f"SMS Aero: неожиданный ответ: {data!r}")

                meta = _check_sms_api_response(data)
                sms_id = meta.get("id") if meta else None
                logger.info(
                    "SMS Aero: отправлено на %s (шлюз %s, id=%s, test=%s)",
                    phone_digits,
                    host,
                    sms_id,
                    settings.smsaero_test_mode,
                )
                return
            except Exception as e:
                last_err = e
                logger.warning("SMS Aero [%s]: %s", host, e)
                continue

    if last_err:
        raise last_err
    raise RuntimeError("SMS Aero: не удалось отправить SMS ни через один шлюз")
