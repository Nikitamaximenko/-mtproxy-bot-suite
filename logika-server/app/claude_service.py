from __future__ import annotations

import json
import logging
import re
from typing import Any

from anthropic import AsyncAnthropic

from app.config import Settings

logger = logging.getLogger(__name__)

SYSTEM_INTERVIEW = """Ты — «Логика», ассистент для проверки решений пользователя.
Пиши по-русски, на «ты». Коротко, без морализаторства.
Задаёшь ровно ОДИН уточняющий вопрос за раз, чтобы выявить логические противоречия и когнитивные искажения.
Не давай финального вердикта до завершения серии вопросов."""

SYSTEM_ANALYSIS = """Ты — «Логика». По транскрипту диалога верни ТОЛЬКО валидный JSON без markdown, со структурой:
{
  "overall_score": <int 0-100>,
  "verdict_short": "<одна строка вердикта>",
  "laws": [
    {"name": "тождество|непротиворечие|исключённого третьего|достаточного основания", "status": "да|нет|частично", "comment": "..."}
  ],
  "biases": [{"name": "...", "hint": "где проявилось"}],
  "alternatives": ["...", "...", "..."],
  "quote": {"text": "...", "author": "..."},
  "summary": "<2-3 абзаца итога>"
}
Числа и формулировки — по сути дела пользователя."""


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    m = re.search(r"\{[\s\S]*\}\s*$", text)
    if not m:
        raise ValueError("Нет JSON в ответе модели")
    return json.loads(m.group(0))


async def next_clarifying_question(
    settings: Settings,
    dilemma: str,
    prior_messages: list[dict[str, str]],
) -> str:
    if not settings.anthropic_api_key:
        n = len([m for m in prior_messages if m.get("role") == "assistant"])
        return (
            f"[Демо без ключа API] Вопрос {n + 1}: что для тебя важнее — ясность или одобрение?"
        )

    api_messages: list[dict[str, Any]] = [
        {"role": "user", "content": f"Дилемма пользователя:\n{dilemma}"},
    ]
    for m in prior_messages:
        api_messages.append({"role": m["role"], "content": m["content"]})

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    resp = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=600,
        system=SYSTEM_INTERVIEW,
        messages=api_messages,
    )
    block = resp.content[0]
    if block.type != "text":
        raise RuntimeError("unexpected block")
    return block.text.strip()


async def analyze_session(
    settings: Settings,
    dilemma: str,
    transcript: list[dict[str, str]],
) -> dict[str, Any]:
    if not settings.anthropic_api_key:
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
            "quote": {"text": "Мыслю, следовательно существую.", "author": "Декарт"},
            "summary": "Подключи ANTHROPIC_API_KEY на сервере для полного отчёта.",
        }

    lines = [f"Дилемма: {dilemma}", "", "Диалог:"]
    for m in transcript:
        who = "Пользователь" if m["role"] == "user" else "Логика"
        c = m.get("content", "")
        lines.append(f"{who}: {c}")
    body = "\n".join(lines)

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    resp = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        system=SYSTEM_ANALYSIS,
        messages=[{"role": "user", "content": body}],
    )
    block = resp.content[0]
    if block.type != "text":
        raise RuntimeError("unexpected block")
    return _extract_json(block.text)
