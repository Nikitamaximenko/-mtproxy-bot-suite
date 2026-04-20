"""Схемы отчёта: валидация и JSON Schema для structured output Anthropic."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class LawItem(BaseModel):
    name: str = Field(description="Краткое имя закона на русском")
    status: Literal["да", "нет", "частично"] = Field(description="Статус проверки")
    comment: str = Field(description="Применение к кейсу пользователя, без выдуманных фактов")


class BiasItem(BaseModel):
    name: str = Field(description="Название искажения")
    hint: str = Field(description="Где проявилось в тексте пользователя")


class QuoteItem(BaseModel):
    """Цитата только из переданного в контексте корпуса; иначе null."""

    text: str
    author: str
    source_id: str | None = Field(
        default=None,
        description="ID записи из курируемого корпуса; null если цитату не удалось привязать",
    )


class AnalysisReport(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    verdict_short: str = Field(max_length=400)
    laws: list[LawItem] = Field(min_length=4, max_length=4)
    biases: list[BiasItem] = Field(min_length=1, max_length=8)
    alternatives: list[str] = Field(min_length=3, max_length=5)
    quote: QuoteItem | None = None
    summary: str = Field(description="2–4 абзаца, осторожные формулировки")
    prompt_version: str = Field(default="v2-cascade")


class SelfCritiqueResult(BaseModel):
    """Второй проход Opus: проверка слабых мест и итоговый отчёт."""

    hallucination_risks: list[str] = Field(
        default_factory=list,
        description="Где вывод мог бы быть необоснованным",
    )
    corrections_applied: list[str] = Field(
        default_factory=list,
        description="Что скорректировано относительно черновика",
    )
    confidence_0_100: int = Field(ge=0, le=100, description="Уверенность в финальном отчёте")
    final_report: AnalysisReport


def analysis_json_schema() -> dict:
    return AnalysisReport.model_json_schema()


def critique_json_schema() -> dict:
    return SelfCritiqueResult.model_json_schema()
