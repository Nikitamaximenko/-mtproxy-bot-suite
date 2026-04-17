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

# Ключи НЕ кэшируем на уровне модуля: на Railway env иногда виден только после полного старта процесса;
# повторное чтение через os.getenv гарантирует актуальное значение в run_support_reply.
def llm_api_key() -> str:
    return (os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip()

OPENAI_BASE_URL = (os.getenv("OPENAI_BASE_URL") or "https://openrouter.ai/api/v1").rstrip("/")
# openrouter/free — free-роутер OpenRouter: сам выбирает живую free-модель с tools-support,
# обходит upstream rate-limits конкретных провайдеров. Проверено: отдаёт корректные tool_calls.
SUPPORT_AI_MODEL = (os.getenv("SUPPORT_AI_MODEL") or "openrouter/free").strip()
# Fallback — конкретная стабильная free-модель с tools; используется если основная вернула 4xx/5xx.
SUPPORT_AI_FALLBACK_MODEL = (os.getenv("SUPPORT_AI_FALLBACK_MODEL") or "openai/gpt-oss-120b:free").strip()
# По умолчанию ВЫКЛ: free-модели склонны галлюцинировать и выдавать доступ без реальной причины.
SUPPORT_AI_ALLOW_GRANT = os.getenv("SUPPORT_AI_ALLOW_GRANT", "false").strip().lower() in (
    "1",
    "true",
    "yes",
)
SUPPORT_AI_TEMPERATURE = float(os.getenv("SUPPORT_AI_TEMPERATURE", "0.35") or "0.35")
# Максимум сообщений истории (user+assistant+tool), которые пробрасываем обратно в модель.
SUPPORT_AI_HISTORY_LIMIT = int(os.getenv("SUPPORT_AI_HISTORY_LIMIT", "12") or "12")

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
        "Authorization": f"Bearer {llm_api_key()}",
        "Content-Type": "application/json",
    }
    if "openrouter.ai" in OPENAI_BASE_URL:
        referer = (os.getenv("OPENROUTER_HTTP_REFERER") or FRONTEND_URL or "https://t.me").strip()
        title = (os.getenv("OPENROUTER_APP_NAME") or "Frosty Support").strip()[:128]
        h["HTTP-Referer"] = referer or "https://t.me"
        h["X-Title"] = title
    return h


def _miniapp_url(tg_id: int) -> str | None:
    import time

    base = FRONTEND_URL.rstrip("/")
    if not base:
        return None
    path = MINIAPP_PATH if MINIAPP_PATH.startswith("/") else f"/{MINIAPP_PATH}"
    v = int(time.time())
    return f"{base}{path}?tg_id={tg_id}&v={v}"


SYSTEM_PROMPT = f"""Ты — служба поддержки сервиса Frosty: подписка «2 в 1» — MTProxy для Telegram + VPN (VLESS Reality) за {PRICE_RUB} ₽/мес.

Правила:
- Пиши по-русски, кратко и по делу, без воды и лишних извинений. 2–5 предложений — норма.
- Не выдумывай факты. Даты подписки и ссылки бери ТОЛЬКО через get_subscription_status.
- Оплата: мини-приложение Telegram (кнопка «2 в 1 — Прокси + VPN» в боте), карта или СБП. Для ссылки — get_payment_instructions.
- Прокси Telegram: в мини-приложении вкладка «Telegram», кнопка подключения MTProxy.
- VPN: приложение Happ (Android/iOS). Конфиг — в мини-приложении, вкладка «VPN».
- Если пользователь жалуется, что у него уже есть подписка, но кнопок нет — попроси открыть «Статус» в боте; если всё равно пусто — предложи написать админу.
- grant_complimentary_access вызывай ТОЛЬКО когда пользователь явно описал техническую невозможность оплаты (банк не пропускает, нет карты/СБП/Apple Pay). Запрашивай короткое подтверждение и пиши чёткую причину в reason. Никогда не выдавай доступ «за жалобу» или «на пробу»."""


TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_subscription_status",
            "description": "Проверить подписку пользователя: активна ли, дата окончания.",
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
        if pay_url:
            text = (
                f"Цена {PRICE_RUB} ₽/мес. Откройте в боте кнопку «2 в 1 — Прокси + VPN» "
                f"или мини-приложение по ссылке: {pay_url}"
            )
            return json.dumps({"instructions": text, "mini_app_url": pay_url}, ensure_ascii=False)
        text = (
            f"Цена {PRICE_RUB} ₽/мес. Откройте в боте кнопку «2 в 1 — Прокси + VPN» — "
            "откроется мини-приложение Telegram с оплатой по карте или СБП."
        )
        return json.dumps({"instructions": text}, ensure_ascii=False)

    if name == "grant_complimentary_access":
        if not SUPPORT_AI_ALLOW_GRANT:
            return json.dumps(
                {
                    "ok": False,
                    "message": (
                        "Автовыдача доступа отключена. Сообщи пользователю, что нужно "
                        "обратиться к администратору — доступ выдаст человек."
                    ),
                },
                ensure_ascii=False,
            )
        reason = (args.get("reason") or "").strip()[:500]
        if not reason or len(reason) < 10:
            return json.dumps(
                {"ok": False, "error": "Нужна конкретная причина (reason), минимум 10 символов."},
                ensure_ascii=False,
            )
        url = f"{BACKEND_BASE_URL}/internal/support/activate/{tg_id}"
        try:
            async with session.post(
                url,
                headers={**_internal_headers(), "Content-Type": "application/json"},
                json={"reason": reason},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                body = await resp.text()
                if resp.status == 200:
                    _log.info("support_ai grant OK tg_id=%s reason=%s", tg_id, reason)
                    return json.dumps(
                        {"ok": True, "message": "Доступ активирован на 30 дней."},
                        ensure_ascii=False,
                    )
                _log.warning("support_ai grant FAIL tg_id=%s status=%s body=%s", tg_id, resp.status, body[:200])
                return json.dumps(
                    {"ok": False, "status": resp.status, "detail": body[:200]},
                    ensure_ascii=False,
                )
        except Exception as e:
            _log.exception("grant_complimentary_access")
            return json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False)

    return json.dumps({"error": "unknown_tool", "name": name})


def _trim_history(history: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    """Оставляем последние N сообщений + обязательно парные tool_call → tool ответы."""
    if len(history) <= limit:
        return list(history)
    tail = history[-limit:]
    # Если первое сообщение в хвосте — tool без соответствующего assistant(tool_calls), обрезаем и его.
    while tail and tail[0].get("role") == "tool":
        tail = tail[1:]
    return tail


async def _call_llm(
    session: aiohttp.ClientSession,
    url: str,
    headers: dict[str, str],
    model: str,
    messages: list[dict[str, Any]],
    use_tools: bool,
) -> tuple[int, dict[str, Any] | None]:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": SUPPORT_AI_TEMPERATURE,
        "max_tokens": 1200,
    }
    if use_tools:
        payload["tools"] = TOOLS
        payload["tool_choice"] = "auto"
    try:
        async with session.post(
            url,
            headers=headers,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=90),
        ) as resp:
            status = resp.status
            try:
                raw = await resp.json(content_type=None)
            except Exception:
                raw = {"error": {"message": (await resp.text())[:300]}}
            return status, raw if isinstance(raw, dict) else {"raw": raw}
    except Exception as e:
        _log.warning("LLM chat/completions request failed (model=%s): %s", model, e)
        return 0, None


def _is_tools_unsupported(err_msg: str) -> bool:
    m = (err_msg or "").lower()
    return "tool" in m and ("support" in m or "unsupported" in m or "not support" in m)


async def run_support_reply(
    session: aiohttp.ClientSession,
    tg_id: int,
    user_text: str,
    history: list[dict[str, Any]] | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """
    Один раунд диалога: до нескольких tool-calls, затем текст ответа.

    history: список сообщений в формате OpenAI (roles: user/assistant/tool/system без system —
    system добавляем сами). Возвращаем (reply_text, new_history).
    """
    key = llm_api_key()
    if not key:
        _log.warning(
            "support_ai: no OPENROUTER_API_KEY/OPENAI_API_KEY at request time (check Railway → bot service Variables)"
        )
        return (
            (
                "Помощник ИИ не настроен: в .env нужен OPENROUTER_API_KEY (OpenRouter) "
                "или OPENAI_API_KEY. Напишите администратору или попробуйте позже."
            ),
            list(history or []),
        )

    headers = _chat_completion_headers()
    prev: list[dict[str, Any]] = _trim_history(list(history or []), SUPPORT_AI_HISTORY_LIMIT)
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *prev,
        {"role": "user", "content": user_text},
    ]
    url = f"{OPENAI_BASE_URL}/chat/completions"

    model = SUPPORT_AI_MODEL
    use_tools = True
    last_tool_result: str | None = None

    for _ in range(6):
        status, raw = await _call_llm(session, url, headers, model, messages, use_tools)
        if raw is None:
            reply = "Сервис ответа временно недоступен. Попробуйте через минуту."
            return reply, _append_turn(prev, user_text, reply)

        if status >= 400:
            err = raw.get("error", {}) if isinstance(raw, dict) else {}
            msg_text = (err.get("message") or str(raw))[:300]
            _log.warning("LLM error model=%s status=%s msg=%s", model, status, msg_text)

            # Модель не поддерживает tools → повторяем без tools на той же модели
            if use_tools and _is_tools_unsupported(msg_text):
                use_tools = False
                continue

            # Модель недоступна / плохой id → пробуем fallback один раз
            if model != SUPPORT_AI_FALLBACK_MODEL and status in (400, 404, 429, 503):
                model = SUPPORT_AI_FALLBACK_MODEL
                use_tools = True
                continue

            reply = (
                f"Не удалось получить ответ ИИ ({status}). Напишите администратору или попробуйте позже."
            )
            return reply, _append_turn(prev, user_text, reply)

        choices = raw.get("choices") or []
        if not choices:
            reply = "Пустой ответ сервиса. Попробуйте ещё раз."
            return reply, _append_turn(prev, user_text, reply)

        msg = choices[0].get("message") or {}
        tool_calls = msg.get("tool_calls")

        if tool_calls and use_tools:
            messages.append(msg)
            for tc in tool_calls:
                tid = tc.get("id") or ""
                fn = tc.get("function") or {}
                fname = fn.get("name") or ""
                fargs = fn.get("arguments") or "{}"
                result = await _call_tool(session, fname, fargs, tg_id)
                last_tool_result = result
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
            # Сохраняем в историю только user-видимые сообщения (без tool-мусора).
            return out, _append_turn(prev, user_text, out)

        # Пусто — попробуем ещё раз без tools, иначе синтезируем ответ из tool-результата.
        if use_tools:
            use_tools = False
            continue
        if last_tool_result:
            reply = _fallback_from_tool_result(last_tool_result)
            return reply, _append_turn(prev, user_text, reply)
        reply = "Не удалось сформулировать ответ. Переформулируйте вопрос или напишите администратору."
        return reply, _append_turn(prev, user_text, reply)

    reply = "Слишком много шагов. Откройте чат заново через /support."
    return reply, _append_turn(prev, user_text, reply)


def _append_turn(
    prev: list[dict[str, Any]], user_text: str, assistant_text: str
) -> list[dict[str, Any]]:
    out = list(prev)
    out.append({"role": "user", "content": user_text})
    out.append({"role": "assistant", "content": assistant_text})
    return _trim_history(out, SUPPORT_AI_HISTORY_LIMIT)


def _fallback_from_tool_result(raw: str) -> str:
    """Когда модель молчит после tool-ответа — собираем минимально полезный ответ."""
    try:
        data = json.loads(raw)
    except Exception:
        return "Готово. Если остались вопросы — напишите ещё раз."
    if not isinstance(data, dict):
        return "Готово. Если остались вопросы — напишите ещё раз."
    if data.get("error"):
        return "Не удалось получить данные. Попробуйте ещё раз или напишите администратору."
    if "active" in data:
        if data.get("active"):
            return (
                f"Подписка активна до {data.get('expires_at') or 'неизвестной даты'}. "
                "Ссылки и кнопки — в разделе «Статус» бота."
            )
        if data.get("suspended"):
            return "Доступ временно приостановлен. Напишите администратору для разблокировки."
        return f"Активной подписки нет. Оплатить — кнопка «2 в 1 — Прокси + VPN» в меню бота."
    if data.get("ok") is True:
        return str(data.get("message") or "Готово.")
    if "instructions" in data:
        return str(data.get("instructions") or "")
    return "Готово. Если остались вопросы — напишите ещё раз."
