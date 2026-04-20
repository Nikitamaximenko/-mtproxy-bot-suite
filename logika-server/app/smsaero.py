"""Клиент SMS Aero API v2: https://smsaero.ru/integration/documentation/api/"""

from __future__ import annotations

import logging
from urllib.parse import quote_plus

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

GATES = ("gate.smsaero.ru", "gate.smsaero.org")


def _sms_url(email: str, api_key: str, host: str, selector: str) -> str:
    return f"https://{quote_plus(email)}:{quote_plus(api_key)}@{host}/v2/{selector}"


async def send_otp_sms(settings: Settings, phone_digits: str, code: str) -> None:
    if not settings.smsaero_email or not settings.smsaero_api_key:
        logger.warning("SMS Aero не настроен — код в логах")
        logger.info("OTP для %s: %s", phone_digits, code)
        return

    text = f"Код входа Логика: {code}"
    payload = {
        "number": int(phone_digits),
        "text": text,
        "sign": settings.smsaero_sign,
    }
    last_err: Exception | None = None
    async with httpx.AsyncClient(timeout=30.0) as client:
        for host in GATES:
            url = _sms_url(settings.smsaero_email, settings.smsaero_api_key, host, "sms/send")
            try:
                r = await client.post(url, json=payload)
                r.raise_for_status()
                data = r.json()
                if data.get("success"):
                    logger.info("SMS Aero: отправлено на %s", phone_digits)
                    return
                if data.get("result") == "no credits":
                    raise RuntimeError("SMS Aero: недостаточно средств")
                raise RuntimeError(data.get("message") or str(data))
            except Exception as e:
                last_err = e
                logger.warning("SMS Aero %s: %s", host, e)
                continue
    if last_err:
        raise last_err
    raise RuntimeError("SMS Aero: не удалось отправить SMS")
