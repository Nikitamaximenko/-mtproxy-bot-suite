from __future__ import annotations

from functools import lru_cache

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

    anthropic_api_key: str = ""
    # Общий fallback (если где-то ожидается одна модель)
    anthropic_model: str = "claude-opus-4-7"

    # Каскад: переопредели под актуальные id в Anthropic Console
    anthropic_model_router: str = "claude-haiku-4-5-20251001"
    anthropic_model_questions: str = "claude-sonnet-4-6"
    anthropic_model_analysis: str = "claude-opus-4-7"
    anthropic_model_critique: str = "claude-opus-4-7"
    opus_effort: str = "high"  # low|medium|high|xhigh|max — усилие рассуждения (structured output)

    enable_router: bool = True
    enable_self_critique: bool = True

    questions_count: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()
