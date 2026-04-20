"""Каскад: Haiku (роутер) → Sonnet/Opus (вопросы) → Opus (анализ + JSON) → Opus (self-critique). Модели — см. Settings."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any

from anthropic import AsyncAnthropic

from app.anthropic_client import get_async_anthropic
from app.config import Settings
from app.data.quotes_corpus import retrieve_quotes_for_context
from app.prompts.master import (
    PROMPT_VERSION,
    SYSTEM_CRITIQUE,
    SYSTEM_INTERVIEW_SHORT,
    cached_system_blocks,
    user_payload_analysis,
    user_payload_critique,
)
from app.prompts.master import SAFETY_AND_SCOPE as _SAFE
from app.schemas.report import AnalysisReport, SelfCritiqueResult, analysis_json_schema, critique_json_schema

logger = logging.getLogger(__name__)


def _use_router(s: Settings) -> bool:
    return s.enable_router and not s.fast_analysis


def _use_self_critique(s: Settings) -> bool:
    return s.enable_self_critique and not s.fast_analysis


def _analysis_thinking(s: Settings) -> bool:
    if s.fast_analysis:
        return False
    return s.anthropic_analysis_thinking


def _critique_thinking(s: Settings) -> bool:
    if s.fast_analysis:
        return False
    return s.anthropic_critique_thinking


def _resolved_effort(s: Settings) -> str:
    if s.fast_analysis:
        return "medium"
    return s.opus_effort


def _analysis_max_tokens(s: Settings) -> int:
    if s.fast_analysis:
        return min(s.anthropic_analysis_max_tokens, 8192)
    return s.anthropic_analysis_max_tokens


def _text_blocks(resp: Any) -> str:
    parts: list[str] = []
    for b in resp.content:
        if b.type == "text":
            parts.append(b.text)
    return "\n".join(parts).strip()


def _parse_json_loose(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    m = re.search(r"\{[\s\S]*\}\s*$", raw)
    if not m:
        raise ValueError("Нет JSON в ответе")
    return json.loads(m.group(0))


async def _messages_create(
    client: AsyncAnthropic,
    *,
    model: str,
    system: str | list[dict[str, Any]],
    user: str,
    max_tokens: int,
    thinking: bool,
    output_json_schema: dict[str, Any] | None,
    effort: str = "high",
) -> Any:
    kwargs: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    if thinking:
        kwargs["thinking"] = {"type": "adaptive"}
    if output_json_schema is not None:
        kwargs["output_config"] = {
            "effort": effort,
            "format": {"type": "json_schema", "schema": output_json_schema},
        }
    try:
        return await client.messages.create(**kwargs)
    except Exception as e:
        logger.warning("Primary call failed (%s), retry without thinking: %s", model, e)
        kwargs.pop("thinking", None)
        if output_json_schema is not None:
            kwargs["output_config"] = {"format": {"type": "json_schema", "schema": output_json_schema}}
        return await client.messages.create(**kwargs)


async def route_intent(settings: Settings, dilemma: str) -> dict[str, Any]:
    """Дешёвый фильтр: категория + можно ли тратить дорогой анализ."""
    if not settings.anthropic_api_key or not _use_router(settings):
        return {"actionable": True, "category": "unknown", "note": "router off"}
    client = get_async_anthropic(settings.anthropic_api_key)
    user = f"""Дилемма пользователя (одним абзацем):
{dilemma}

Верни ТОЛЬКО JSON: {{"actionable": true/false, "category": "работа|отношения|деньги|здоровье|другое", "reason": "коротко"}} 
actionable=false если это пустая болтовня без решения или явный спам."""
    resp = await client.messages.create(
        model=settings.anthropic_model_router,
        max_tokens=300,
        system="Ты классификатор. Только JSON, без markdown.",
        messages=[{"role": "user", "content": user}],
    )
    try:
        return _parse_json_loose(_text_blocks(resp))
    except Exception:
        return {"actionable": True, "category": "unknown", "reason": "parse fail"}


async def next_clarifying_question(
    settings: Settings,
    dilemma: str,
    prior_messages: list[dict[str, str]],
) -> str:
    if not settings.anthropic_api_key:
        if settings.anthropic_allow_demo_without_key:
            n = len([m for m in prior_messages if m.get("role") == "assistant"])
            return (
                f"[Демо без ключа API] Вопрос {n + 1}: что для тебя важнее — ясность или одобрение?"
            )
        raise RuntimeError(
            "На сервере не задан ANTHROPIC_API_KEY (Railway → Variables сервиса с logika-server). "
            "Для локальной разработки без ключа: ANTHROPIC_ALLOW_DEMO_WITHOUT_KEY=true",
        )

    api_messages: list[dict[str, Any]] = [
        {"role": "user", "content": f"Дилемма пользователя:\n{dilemma}"},
    ]
    for m in prior_messages:
        api_messages.append({"role": m["role"], "content": m["content"]})

    client = get_async_anthropic(settings.anthropic_api_key)
    resp = await client.messages.create(
        model=settings.anthropic_model_questions,
        max_tokens=500,
        system=SYSTEM_INTERVIEW_SHORT + "\n" + _SAFE,
        messages=api_messages,
    )
    return _text_blocks(resp)


async def analyze_session(
    settings: Settings,
    dilemma: str,
    transcript: list[dict[str, str]],
) -> dict[str, Any]:
    if not settings.anthropic_api_key:
        if settings.anthropic_allow_demo_without_key:
            return _demo_report()
        raise RuntimeError(
            "На сервере не задан ANTHROPIC_API_KEY (Railway → Variables). "
            "Либо ANTHROPIC_ALLOW_DEMO_WITHOUT_KEY=true только для локалки."
        )

    lines = [f"Дилемма: {dilemma}", "", "Диалог:"]
    for m in transcript:
        who = "Пользователь" if m["role"] == "user" else "Логика"
        c = m.get("content", "")
        lines.append(f"{who}: {c}")
    transcript_text = "\n".join(lines)

    async def _quotes_block() -> str:
        return await asyncio.to_thread(retrieve_quotes_for_context, dilemma, "", 8)

    quotes_block, _route_meta = await asyncio.gather(
        _quotes_block(),
        route_intent(settings, dilemma),
    )
    user_1 = user_payload_analysis(dilemma, transcript_text, quotes_block)

    client = get_async_anthropic(settings.anthropic_api_key)
    schema = analysis_json_schema()

    resp1 = await _messages_create(
        client,
        model=settings.anthropic_model_analysis,
        system=cached_system_blocks(),
        user=user_1,
        max_tokens=_analysis_max_tokens(settings),
        thinking=_analysis_thinking(settings),
        output_json_schema=schema,
        effort=_resolved_effort(settings),
    )
    raw1 = _text_blocks(resp1)
    try:
        draft = AnalysisReport.model_validate_json(raw1)
    except Exception:
        draft = AnalysisReport.model_validate(_parse_json_loose(raw1))
    draft_dict = draft.model_dump()

    if not _use_self_critique(settings):
        out = draft_dict
        out["prompt_version"] = PROMPT_VERSION
        out["models"] = {
            "questions": settings.anthropic_model_questions,
            "analysis": settings.anthropic_model_analysis,
            "fast_analysis": settings.fast_analysis,
        }
        return out

    user_2 = user_payload_critique(
        json.dumps(draft_dict, ensure_ascii=False),
        dilemma,
        transcript_text,
        quotes_block,
    )
    crit_schema = critique_json_schema()
    resp2 = await _messages_create(
        client,
        model=settings.anthropic_model_critique,
        system=[
            {
                "type": "text",
                "text": SYSTEM_CRITIQUE,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        user=user_2,
        max_tokens=_analysis_max_tokens(settings),
        thinking=_critique_thinking(settings),
        output_json_schema=crit_schema,
        effort=_resolved_effort(settings),
    )
    raw2 = _text_blocks(resp2)
    try:
        crit = SelfCritiqueResult.model_validate_json(raw2)
    except Exception:
        crit = SelfCritiqueResult.model_validate(_parse_json_loose(raw2))

    final = crit.final_report.model_dump()
    final["prompt_version"] = PROMPT_VERSION
    final["self_critique"] = {
        "risks": crit.hallucination_risks,
        "corrections": crit.corrections_applied,
        "confidence": crit.confidence_0_100,
    }
    final["models"] = {
        "router": settings.anthropic_model_router,
        "questions": settings.anthropic_model_questions,
        "analysis": settings.anthropic_model_analysis,
        "critique": settings.anthropic_model_critique,
        "fast_analysis": settings.fast_analysis,
    }
    return final


def _demo_report() -> dict[str, Any]:
    return {
        "overall_score": 42,
        "verdict_short": "Демо-режим: задай ANTHROPIC_API_KEY",
        "laws": [
            {"name": "тождество", "status": "частично", "comment": "…"},
            {"name": "непротиворечие", "status": "да", "comment": "…"},
            {"name": "исключённого третьего", "status": "нет", "comment": "…"},
            {"name": "достаточного основания", "status": "частично", "comment": "…"},
        ],
        "biases": [{"name": "демо", "hint": "нет ключа API"}],
        "alternatives": ["Уточнить цифры", "Отложить решение", "Собрать факты"],
        "quote": {"text": "Мыслю, следовательно существую.", "author": "Декарт", "source_id": None},
        "summary": "Подключи ANTHROPIC_API_KEY на сервере для полного отчёта.",
        "conclusion": "Итог: без ключа API полный анализ недоступен — задай переменную на сервере и повтори запрос.",
        "prompt_version": PROMPT_VERSION,
    }
