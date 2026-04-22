from __future__ import annotations

from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./logika.db"
    jwt_secret: str = "dev-change-me-in-production-min-32-chars!!"
    cors_origins: str = "http://localhost:5173"
    public_api_url: str = "http://localhost:8000"

    smsaero_email: str = ""
    smsaero_api_key: str = ""
    smsaero_sign: str = "SMS Aero"
    # Локально true: код только в логах uvicorn. На Railway в prod оставь false и задай SMSAERO_*.
    smsaero_allow_log_only: bool = False
    # true = метод sms/testsend (без реальной отправки по правилам SMS Aero; см. документацию).
    smsaero_test_mode: bool = False
    # Таймаут HTTP к шлюзу SMS Aero (сек.): меньше — быстрее отказ при проблемной сети.
    smsaero_http_timeout_seconds: float = 12.0

    # SMTP для OTP по email (классическая регистрация по почте)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_tls: bool = True
    # Для провайдеров с implicit TLS (обычно порт 465): SMTP over SSL без starttls().
    smtp_use_ssl: bool = False
    # Локально без SMTP: true — код в логах uvicorn
    email_allow_log_only: bool = False
    # Telegram Login Widget (https://core.telegram.org/widgets/login): токен бота для проверки hash.
    telegram_bot_token: str = ""

    anthropic_api_key: str = ""
    # Локально true — шаблонные ответы без Claude. На Railway prod держи false и задай ANTHROPIC_API_KEY.
    anthropic_allow_demo_without_key: bool = False
    # Общий fallback (если где-то ожидается одна модель)
    anthropic_model: str = "claude-opus-4-7"

    # Каскад: переопредели под актуальные id в Anthropic Console
    anthropic_model_router: str = "claude-haiku-4-5-20251001"
    # Уточняющие вопросы: по умолчанию Sonnet (быстрее Opus); для максимальной глубины задай Opus в env.
    anthropic_model_questions: str = "claude-sonnet-4-5-20250929"
    anthropic_model_analysis: str = "claude-opus-4-7"
    anthropic_model_critique: str = "claude-opus-4-7"
    opus_effort: str = "high"  # low|medium|high|xhigh|max — усилие рассуждения (structured output)
    # Макс. токены ответа анализа (ниже — чуть быстрее и дешевле).
    anthropic_analysis_max_tokens: int = 12000
    # Adaptive thinking для structured JSON (дорого по времени). FAST_ANALYSIS отключает.
    anthropic_analysis_thinking: bool = True
    anthropic_critique_thinking: bool = True

    enable_router: bool = True
    enable_self_critique: bool = True
    # Один флаг: Sonnet-вопросы из env; router/critique/thinking выключаются; effort ниже. На проде по умолчанию true — быстрее финальный отчёт.
    fast_analysis: bool = True

    questions_count: int = 5

    # PDF: «playwright» = тот же HTML, что экран отчёта (Chromium); «reportlab» = запасной без браузера.
    pdf_engine: Literal["playwright", "reportlab"] = "playwright"
    # true: при сбое Playwright отдать ReportLab — скачивание не ломается (типичный прод без Chromium).
    # false: только Playwright (как на сайте); задавай вместе с рабочим `playwright install chromium` в образе.
    pdf_fallback_reportlab: bool = True

    @field_validator("smsaero_email", "smsaero_api_key", "anthropic_api_key", mode="before")
    @classmethod
    def _strip_secrets(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("smsaero_sign", "smtp_user", "smtp_password", "smtp_from", mode="before")
    @classmethod
    def _strip_sign(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v


def get_settings() -> Settings:
    """Без lru_cache: на Railway переменные должны подхватываться после redeploy без залипания старых значений."""
    return Settings()
