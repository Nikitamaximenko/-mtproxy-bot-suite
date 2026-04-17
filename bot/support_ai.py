"""
ИИ-поддержка в Telegram: OpenAI-compatible Chat Completions + tools (статус, оплата, выдача доступа).

По умолчанию: OpenRouter (дешёвые/бесплатные модели). Ключ: OPENROUTER_API_KEY или совместимый OPENAI_API_KEY.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

import aiohttp

_log = logging.getLogger(__name__)

# OpenRouter: https://openrouter.ai — один ключ для разных моделей; бесплатные: суффикс :free или модель openrouter/free
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
LLM_API_KEY = OPENROUTER_API_KEY or OPENAI_API_KEY

OPENAI_BASE_URL = (os.getenv("OPENAI_BASE_URL") or "https://openrouter.ai/api/v1").rstrip("/")
# Бесплатный роутер OpenRouter или любая модель вида org/model:free — см. https://openrouter.ai/models?order=newest&pricing=free
SUPPORT_AI_MODEL = (os.getenv("SUPPORT_AI_MODEL") or "openrouter/free").strip()
SUPPORT_AI_ALLOW_GRANT = os.getenv("SUPPORT_AI_ALLOW_GRANT", "true").strip().lower() in (
    "1",
    "true",
    "yes",
)

BACKEND_BASE_URL = (os.getenv("BACKEND_BASE_URL") or "http://localhost:8000").rstrip("/")
INTERNAL_API_TOKEN = os.getenv("INTERNAL_API_TOKEN", "").strip()
FRONTEND_URL = (os.getenv("FRONTEND_URL") or "").strip()
MINIAPP_PATH = (os.getenv("MINIAPP_PATH") or "/mini").strip() or "/mini"
PRICE_RUB = int(os.getenv("PRICE_RUB", "299") or "299")


def _internal_headers() -> dict[str, str]:
    if not INTERNAL_API_TOKEN:
        return {}
    return {"X-Internal-Token": INTERNAL_API_TOKEN}


def _chat_completion_headers() -> dict[str, str]:
    """Заголовки для /chat/completions. OpenRouter просит Referer и Title для рейтинга."""
    h: dict[str, str] = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    if "openrouter.ai" in OPENAI_BASE_URL:
        referer = (os.getenv("OPENROUTER_HTTP_REFERER") or FRONTEND_URL or "https://t.me").strip()
        title = (os.getenv("OPENROUTER_APP_NAME") or "Frosty Support").strip()[:128]
        h["HTTP-Referer"] = referer or "https://t.me"
        h["X-Title"] = title
    return h


def _miniapp_url(tg_id: int) -> str:
    import time

    base = FRONTEND_URL.rstrip("/")
    path = MINIAPP_PATH if MINIAPP_PATH.startswith("/") else f"/{MINIAPP_PATH}"
    v = int(time.time())
    return f"{base}{path}?tg_id={tg_id}&v={v}"


SYSTEM_PROMPT = f"""Ты — служба поддержки сервиса Frosty: подписка «прокси для Telegram (MTProxy) + VPN (VLESS Reality)» за {PRICE_RUB} ₽/мес.

Правила:
- Пиши по-русски, кратко и по делу.
- Оплата: мини-приложение Telegram (кнопка в боте), карта и СБП. Для ссылки на оплату вызывай get_payment_instructions.
- VPN: приложение Happ (Android/iOS), конфиг в личном кабинете — «Открыть в Happ», копирование ссылки, QR.
- Прокси Telegram: после оплаты в разделе статуса — «Подключить прокси» (ссылка tg://proxy).
- Если пользователь **явно не может оплатить** (банк отклоняет, нет карт/СБП) и просит доступ — используй grant_complimentary_access. Не выдавай доступ без явной проблемы с оплатой.
- Факты о подписке только через get_subscription_status; не выдумывай даты и ссылки."""


TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_subscription_status",
            "description": "Проверить подписку пользователя: активна ли, дата окончания, есть ли ссылка на MTProxy.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_payment_instructions",
            "description": "Подсказка пользователю, как оплатить: мини-приложение и цена.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "grant_complimentary_access",
            "description": "Выдать доступ на 30 дней без оплаты, если пользователь не может оплатить технически.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "Кратко: почему выдаём (для логов)",
                    }
                },
                "required": ["reason"],
                "additionalProperties": False,
            },
        },
    },
]


async def _call_tool(
    session: aiohttp.ClientSession,
    name: str,
    arguments: str,
    tg_id: int,
) -> str:
    try:
        args = json.loads(arguments) if arguments else {}
    except json.JSONDecodeError:
        return json.dumps({"error": "invalid_arguments"})

    if name == "get_subscription_status":
        url = f"{BACKEND_BASE_URL}/subscription/{tg_id}"
        try:
            async with session.get(
                url,
                headers=_internal_headers(),
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                data = await resp.json(content_type=None)
                if resp.status >= 400:
                    return json.dumps({"error": "backend", "status": resp.status})
                return json.dumps(data, ensure_ascii=False, default=str)
        except Exception as e:
            _log.warning("get_subscription_status: %s", e)
            return json.dumps({"error": str(e)})

    if name == "get_payment_instructions":
        pay_url = _miniapp_url(tg_id)
        text = (
            f"Цена {PRICE_RUB} ₽/мес. Откройте в боте кнопку «Прокси + VPN» или мини-приложение по ссылке: {pay_url}"
        )
        return json.dumps({"instructions": text, "mini_app_url": pay_url}, ensure_ascii=False)

    if name == "grant_complimentary_access":
        if not SUPPORT_AI_ALLOW_GRANT:
            return json.dumps({"ok": False, "message": "Выдача доступа отключена (SUPPORT_AI_ALLOW_GRANT)."})
        reason = (args.get("reason") or "").strip()[:500]
        if not reason:
            return json.dumps({"ok": False, "error": "Нужна причина (reason)."})
        url = f"{BACKEND_BASE_URL}/internal/support/activate/{tg_id}"
        try:
            async with session.post(
                url,
                headers={**_internal_headers(), "Content-Type": "application/json"},
                json={"reason": reason},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                _ = await resp.text()
                if resp.status == 200:
                    return json.dumps({"ok": True, "message": "Доступ активирован на 30 дней."}, ensure_ascii=False)
                return json.dumps({"ok": False, "status": resp.status, "detail": _[:200]}, ensure_ascii=False)
        except Exception as e:
            _log.exception("grant_complimentary_access")
            return json.dumps({"ok": False, "error": str(e)})

    return json.dumps({"error": "unknown_tool", "name": name})


async def run_support_reply(
    session: aiohttp.ClientSession,
    tg_id: int,
    user_text: str,
) -> str:
    """Один раунд диалога: до нескольких tool-calls, затем текст ответа."""
    if not LLM_API_KEY:
        return (
            "Помощник не настроен: задайте OPENROUTER_API_KEY (OpenRouter) или OPENAI_API_KEY. "
            "Пока можете написать разработчику или повторить попытку позже."
        )

    headers = _chat_completion_headers()
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_text},
    ]

    url = f"{OPENAI_BASE_URL}/chat/completions"

    for _ in range(6):
        payload: dict[str, Any] = {
            "model": SUPPORT_AI_MODEL,
            "messages": messages,
            "tools": TOOLS,
            "tool_choice": "auto",
            "temperature": 0.35,
            "max_tokens": 1200,
        }
        try:
            async with session.post(
                url,
                headers=headers,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=90),
            ) as resp:
                status = resp.status
                raw = await resp.json(content_type=None)
        except Exception as e:
            _log.warning("LLM chat/completions request failed: %s", e)
            return "Сервис ответа временно недоступен. Попробуйте через минуту."

        if status >= 400:
            _log.warning("OpenAI error %s: %s", status, raw)
            err = raw.get("error", {}) if isinstance(raw, dict) else {}
            msg = err.get("message", str(raw))[:300]
            return f"Не удалось получить ответ ИИ ({status}): {msg}"

        choices = raw.get("choices") or []
        if not choices:
            return "Пустой ответ сервиса. Попробуйте ещё раз."

        msg = choices[0].get("message") or {}
        tool_calls = msg.get("tool_calls")

        if tool_calls:
            messages.append(msg)
            for tc in tool_calls:
                tid = tc.get("id") or ""
                fn = tc.get("function") or {}
                fname = fn.get("name") or ""
                fargs = fn.get("arguments") or "{}"
                result = await _call_tool(session, fname, fargs, tg_id)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tid,
                        "content": result,
                    }
                )
            continue

        content = msg.get("content") or ""
        if isinstance(content, str) and content.strip():
            out = content.strip()
            if len(out) > 4000:
                out = out[:3997] + "…"
            return out

        return "Не удалось сформулировать ответ. Напишите вопрос короче или попробуйте снова."

    return "Слишком много шагов уточнения. Начните диалог заново командой /support."
