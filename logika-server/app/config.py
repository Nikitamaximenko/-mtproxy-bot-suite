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

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-7"

    questions_count: int = 5


@lru_cache
def get_settings() -> Settings:
    return Settings()
