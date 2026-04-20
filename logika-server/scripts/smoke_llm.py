#!/usr/bin/env python3
"""Смоук-тест движка: Sonnet (вопросы) + Opus (анализ + опционально self-critique).
Запуск из каталога logika-server:  python scripts/smoke_llm.py
"""

from __future__ import annotations

import asyncio
import os
import sys
import time

# Укороченный прогон (только один проход Opus) — export SMOKE_FAST=1
FAST = os.getenv("SMOKE_FAST", "").lower() in ("1", "true", "yes")


def _bootstrap() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)
    sys.path.insert(0, root)
    from dotenv import load_dotenv

    load_dotenv(os.path.join(root, ".env"))
    if FAST:
        os.environ["ENABLE_SELF_CRITIQUE"] = "false"
        os.environ["ENABLE_ROUTER"] = "false"
    from app.config import get_settings

    get_settings.cache_clear()


async def main() -> int:
    _bootstrap()
    from app.claude_pipeline import analyze_session, next_clarifying_question, route_intent
    from app.config import get_settings
    from app.pdf_report import build_pdf_bytes

    s = get_settings()
    if not s.anthropic_api_key:
        print("FAIL: ANTHROPIC_API_KEY пуст в .env")
        return 1

    dilemma = (
        "Стоит ли мне уходить из найма в стартап: больше влияния, но меньше предсказуемого дохода. "
        "Боюсь ошибиться под давлением усталости."
    )

    print("=== 1) Router (Haiku) ===")
    t0 = time.perf_counter()
    r = await route_intent(s, dilemma)
    print(f"    {r}  ({time.perf_counter() - t0:.1f}s)")

    print("\n=== 2) Первый уточняющий вопрос (Sonnet) ===")
    t0 = time.perf_counter()
    q1 = await next_clarifying_question(s, dilemma, [])
    print(f"    {q1[:600]}{'…' if len(q1) > 600 else ''}")
    print(f"    ({time.perf_counter() - t0:.1f}s)")

    # Имитация полного диалога (как в БД после 5 ответов пользователя)
    synthetic = [
        {"role": "assistant", "content": q1},
        {"role": "user", "content": "Решение созревало около трёх недель, после провала крупного проекта."},
        {"role": "assistant", "content": "Это противоречит тому, что ты говорил себе полгода назад про «ещё год потерплю»?"},
        {"role": "user", "content": "Да, раньше я откладывал, сейчас честно не хочу терпеть токсичного руководителя."},
        {"role": "assistant", "content": "Какой один факт по деньгам сейчас самый неудобный для твоего решения?"},
        {"role": "user", "content": "Я не считал подушку на 6 месяцев, только оценил эмоционально."},
        {"role": "assistant", "content": "Ты ищешь свободу или в основном хочешь сбежать от боли?"},
        {"role": "user", "content": "Смесь: и от боли, и к росту — но буфер не посчитан."},
        {"role": "assistant", "content": "Если останешься ещё на 90 дней, что должно измениться измеримо?"},
        {"role": "user", "content": "KPI по проекту и понятный план ухода, иначе ухожу."},
    ]

    print("\n=== 3) Полный отчёт (Opus + structured; critique=" + str(s.enable_self_critique and not FAST) + ") ===")
    t0 = time.perf_counter()
    try:
        report = await analyze_session(s, dilemma, synthetic)
    except Exception as e:
        print(f"FAIL analyze_session: {e}")
        return 1
    dt = time.perf_counter() - t0
    print(f"    overall_score: {report.get('overall_score')}")
    print(f"    verdict_short: {str(report.get('verdict_short', ''))[:200]}…")
    laws = report.get("laws") or []
    print(f"    laws: {len(laws)} шт.")
    biases = report.get("biases") or []
    print(f"    biases: {len(biases)} шт.")
    alts = report.get("alternatives") or []
    print(f"    alternatives: {len(alts)} шт.")
    q = report.get("quote")
    print(f"    quote: {q}")
    sc = report.get("self_critique")
    if sc:
        print(f"    self_critique.confidence: {sc.get('confidence')}")
    print(f"    prompt_version: {report.get('prompt_version')}")
    print(f"    ({dt:.1f}s)")

    print("\n=== 4) PDF ===")
    try:
        pdf = build_pdf_bytes(report, dilemma)
        print(f"    PDF bytes: {len(pdf)}")
    except Exception as e:
        print(f"FAIL PDF: {e}")
        return 1

    print("\nOK — движок отработал.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
