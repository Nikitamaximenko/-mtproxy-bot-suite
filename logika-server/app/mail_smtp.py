"""Отправка OTP на почту через SMTP (классический вариант)."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import Settings

logger = logging.getLogger(__name__)


def send_otp_email(settings: Settings, to_address: str, code: str) -> None:
    if not settings.smtp_host:
        if settings.email_allow_log_only:
            logger.warning("SMTP не настроен — код только в логах (EMAIL_ALLOW_LOG_ONLY)")
            logger.info("OTP email для %s: %s", to_address, code)
            return
        raise RuntimeError(
            "Почта не настроена: задайте SMTP_HOST, SMTP_FROM и учётные данные на Railway "
            "(или для локалки EMAIL_ALLOW_LOG_ONLY=true)",
        )

    from_addr = settings.smtp_from or settings.smtp_user
    if not from_addr:
        raise RuntimeError("Задайте SMTP_FROM или SMTP_USER")

    msg = EmailMessage()
    msg["Subject"] = "Код входа «Логика»"
    msg["From"] = from_addr
    msg["To"] = to_address
    msg.set_content(
        f"Код входа Логика: {code}\n\n"
        f"Если вы не запрашивали вход — проигнорируйте это письмо.\n"
    )

    # Два стандартных режима:
    # - SMTP + STARTTLS (587): smtp_use_tls=true, smtp_use_ssl=false
    # - SMTP over SSL (465): smtp_use_ssl=true (или авто по порту 465)
    use_ssl = settings.smtp_use_ssl or (settings.smtp_port == 465 and settings.smtp_use_tls)
    smtp_cls = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP

    with smtp_cls(settings.smtp_host, settings.smtp_port, timeout=25) as smtp:
        smtp.ehlo()
        if settings.smtp_use_tls and not use_ssl:
            smtp.starttls()
            smtp.ehlo()
        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)

    logger.info("SMTP: код отправлен на %s", to_address)
