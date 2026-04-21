"""Схемы отчёта: валидация и JSON Schema для structured output Anthropic."""

from __future__ import annotations

import copy
from typing import Any, Literal

from pydantic import BaseModel, Field

# Имена четырёх законов — для дополнения, если модель вернула меньше элементов
_CANONICAL_LAW_NAMES: tuple[str, ...] = (
    "Закон тождества",
    "Закон непротиворечия",
    "Закон исключённого третьего",
    "Закон достаточного основания",
)

_LAW_PAD_COMMENT = (
    "В переданном материале недостаточно явных опор для отдельной оценки по этому закону — "
    "см. общий вывод; при необходимости уточни контекст в новом диалоге."
)

_ALT_PAD = (
    "Собрать недостающие факты и сроки, затем пересмотреть решение.",
    "Сравнить сценарии по измеримым критериям вместо «ощущения».",
    "Зафиксировать, что считать успехом решения, и проверить это на данных.",
)


def _anthropic_strict_object_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Anthropic structured output: objects need additionalProperties: false; integers cannot use min/max."""

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            if node.get("type") == "object":
                node["additionalProperties"] = False
            if node.get("type") == "integer":
                node.pop("minimum", None)
                node.pop("maximum", None)
            if node.get("type") == "array":
                node.pop("minItems", None)
                node.pop("maxItems", None)
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for x in node:
                walk(x)

    out = copy.deepcopy(schema)
    walk(out)
    return out


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


def normalize_analysis_report_dict(d: dict[str, Any]) -> dict[str, Any]:
    """
    Дополняет/обрезает поля до требований схемы: Anthropic JSON schema без minItems,
    модель иногда возвращает слишком короткие массивы.
    """
    out = dict(d)
    laws: list[Any] = list(out.get("laws") or [])
    if len(laws) > 4:
        laws = laws[:4]
    while len(laws) < 4:
        laws.append(
            {
                "name": _CANONICAL_LAW_NAMES[len(laws)],
                "status": "частично",
                "comment": _LAW_PAD_COMMENT,
            }
        )
    out["laws"] = laws

    biases: list[Any] = list(out.get("biases") or [])
    if len(biases) < 1:
        biases = [
            {
                "name": "Недостаточно явных маркеров",
                "hint": "В тексте мало привязки к типичным искажениям — обобщённая осторожная оценка.",
            }
        ]
    elif len(biases) > 8:
        biases = biases[:8]
    out["biases"] = biases

    alts: list[Any] = list(out.get("alternatives") or [])
    i = 0
    while len(alts) < 3:
        alts.append(_ALT_PAD[i % len(_ALT_PAD)])
        i += 1
    if len(alts) > 5:
        alts = alts[:5]
    out["alternatives"] = alts

    return out


class AnalysisReport(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    verdict_short: str = Field(max_length=400)
    laws: list[LawItem] = Field(min_length=4, max_length=4)
    biases: list[BiasItem] = Field(min_length=1, max_length=8)
    alternatives: list[str] = Field(min_length=3, max_length=5)
    quote: QuoteItem | None = None
    summary: str = Field(description="2–4 абзаца, осторожные формулировки")
    conclusion: str = Field(
        default="",
        max_length=1200,
        description="Финальный вывод в конце отчёта: 2–6 предложений — что это значит для решения пользователя, на что опереться дальше; без новых фактов и без дословного повтора summary",
    )
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
    return _anthropic_strict_object_schema(AnalysisReport.model_json_schema())


def critique_json_schema() -> dict:
    return _anthropic_strict_object_schema(SelfCritiqueResult.model_json_schema())


def normalize_self_critique_dict(d: dict[str, Any]) -> dict[str, Any]:
    """Нормализует final_report внутри ответа self-critique."""
    out = dict(d)
    fr = out.get("final_report")
    if isinstance(fr, dict):
        out["final_report"] = normalize_analysis_report_dict(fr)
    return out
