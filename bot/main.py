from __future__ import annotations

import asyncio
import html
import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import aiohttp
from aiogram import Bot, Dispatcher, F
from aiogram.filters import BaseFilter, Command, CommandStart, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonDefault,
    Message,
    WebAppInfo,
)
from dotenv import load_dotenv


load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
BACKEND_BASE_URL = (os.getenv("BACKEND_BASE_URL") or "http://localhost:8000").rstrip("/")
FRONTEND_URL = (os.getenv("FRONTEND_URL") or "http://localhost:3000").strip()
INTERNAL_API_TOKEN = os.getenv("INTERNAL_API_TOKEN", "").strip()
PRICE_RUB = int(os.getenv("PRICE_RUB", "299") or "299")
MINIAPP_PATH = (os.getenv("MINIAPP_PATH") or "/mini").strip() or "/mini"

_log = logging.getLogger(__name__)


def _has_llm_api_key() -> bool:
    """Ключ LLM: только из окружения (Railway Variables), без кэша при импорте support_ai."""
    return bool((os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip())


def _ai_support_enabled() -> bool:
    """
    ИИ: SUPPORT_AI_ENABLED=false — выкл.; true — вкл. только если задан ключ;
    не задано — вкл. автоматически при наличии OPENROUTER_API_KEY / OPENAI_API_KEY.
    """
    raw = os.getenv("SUPPORT_AI_ENABLED", "").strip().lower()
    if raw in ("0", "false", "no"):
        return False
    if raw in ("1", "true", "yes"):
        return _has_llm_api_key()
    return _has_llm_api_key()


def _bot_admin_ids() -> set[int]:
    raw = os.getenv("BOT_ADMIN_TELEGRAM_IDS", "").strip()
    if not raw:
        return set()
    out: set[int] = set()
    for part in raw.split(","):
        p = part.strip()
        if not p:
            continue
        try:
            out.add(int(p))
        except ValueError:
            continue
    return out


def _support_ai_diagnostic_text() -> str:
    """Без секретов: только флаги и длина ключа."""
    lines = [
        f"ai_enabled={_ai_support_enabled()}",
        f"OPENROUTER_API_KEY set={bool(os.getenv('OPENROUTER_API_KEY', '').strip())}",
        f"OPENAI_API_KEY set={bool(os.getenv('OPENAI_API_KEY', '').strip())}",
        f"SUPPORT_AI_ENABLED={os.getenv('SUPPORT_AI_ENABLED', '')!r}",
        f"INTERNAL_API_TOKEN set={bool(INTERNAL_API_TOKEN)}",
        f"BACKEND_BASE_URL={BACKEND_BASE_URL}",
    ]
    try:
        import support_ai as sa

        k = sa.llm_api_key()
        lines.append(f"support_ai.llm_api_key() len={len(k)}")
        lines.append("support_ai import=ok")
    except Exception as e:
        lines.append(f"support_ai import=FAIL {e!r}")
    return "\n".join(lines)


class SupportStates(StatesGroup):
    chatting = State()


class CheckoutStates(StatesGroup):
    waiting_email = State()


class _TextNotCommand(BaseFilter):
    """Текст не является командой (/...) — чтобы в чате поддержки работали /status и др."""

    async def __call__(self, message: Message) -> bool:
        t = message.text
        if not t:
            return False
        return not t.startswith("/")


def _internal_headers() -> dict[str, str]:
    return {"X-Internal-Token": INTERNAL_API_TOKEN} if INTERNAL_API_TOKEN else {}


def _miniapp_url(tg_id: int) -> str:
    base = FRONTEND_URL.rstrip("/")
    path = MINIAPP_PATH if MINIAPP_PATH.startswith("/") else f"/{MINIAPP_PATH}"
    # Telegram WebView иногда агрессивно кэширует статику.
    # Параметр v заставляет загрузить свежую верстку/скрипты после деплоя.
    # FIX: datetime.utcnow() deprecated since Python 3.12 — use timezone-aware alternative
    v = int(datetime.now(timezone.utc).timestamp())
    return f"{base}{path}?tg_id={tg_id}&v={v}"


def main_menu_kb(tg_id: int, *, show_amnezia: bool = False) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton(text="🎁 Бесплатный день", callback_data="menu:trial")],
        [InlineKeyboardButton(text="💳 Купить / продлить подписку", callback_data="menu:buy_in_bot")],
        [InlineKeyboardButton(text="🛡 Подключить VPN (Frosty)", callback_data="menu:connect")],
    ]
    if show_amnezia:
        rows.append(
            [InlineKeyboardButton(text="🌿 Amnezia VPN (RU+)", callback_data="menu:amnezia")]
        )
    rows.extend(
        [
            [InlineKeyboardButton(text="🧊 Открыть мини-апп", web_app=WebAppInfo(url=_miniapp_url(tg_id)))],
            [InlineKeyboardButton(text="✅ Статус", callback_data="menu:status")],
            [InlineKeyboardButton(text="🚫 Отменить автопродление", callback_data="menu:cancel_recurring")],
        ]
    )
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _amnezia_menu_visible(session: aiohttp.ClientSession, tg_id: int) -> bool:
    try:
        data = await backend_get(session, f"/vpn/amnezia/eligible/{tg_id}")
        return bool(data.get("show_menu"))
    except Exception:
        return False


async def main_menu_kb_for(session: aiohttp.ClientSession, tg_id: int) -> InlineKeyboardMarkup:
    show = await _amnezia_menu_visible(session, tg_id)
    return main_menu_kb(tg_id, show_amnezia=show)


def checkout_provider_kb(tg_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Lava.top (карта)", callback_data="checkout:prov:lava"),
                InlineKeyboardButton(text="ЮKassa (СБП / карта)", callback_data="checkout:prov:yookassa"),
            ],
            [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
        ]
    )


def support_kb() -> InlineKeyboardMarkup | None:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="🆘 Поддержка", callback_data="menu:support")]]
    )


def support_chat_kb(*, show_cancel_autopay: bool = True) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    if show_cancel_autopay:
        rows.append(
            [
                InlineKeyboardButton(
                    text="🚫 Отменить автопродление",
                    callback_data="menu:cancel_recurring",
                )
            ]
        )
    rows.append([InlineKeyboardButton(text="✖️ Закрыть чат", callback_data="menu:exit_support")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def trial_direct_kb(tg_id: int, *, show_copy_button: bool) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    if show_copy_button:
        rows.append([InlineKeyboardButton(text="📋 СКОПИРОВАТЬ VPN-КОД", callback_data="menu:trial_copy_vless")])
    rows.append([InlineKeyboardButton(text="🛡 Подключить VPN", callback_data="menu:connect")])
    rows.append([InlineKeyboardButton(text="💳 Купить полную подписку", callback_data="menu:buy_in_bot")])
    rows.append([InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def cancel_recurring_confirm_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Да, отключить", callback_data="menu:cancel_recurring:ok"),
                InlineKeyboardButton(text="↩️ Нет", callback_data="menu:cancel_recurring:no"),
            ],
        ]
    )


CANCEL_RECURRING_CONFIRM_HTML = (
    "Отключить <b>автопродление</b>?\n\n"
    "Списание сейчас не выполняется: доступ останется до конца уже оплаченного периода, "
    "но <b>следующий платёж не уйдёт сам</b> — продление только если снова оплатите вручную."
)


def support_invite_html() -> str:
    """Текст после нажатия «Поддержка»: диалог в боте; при наличии ключа LLM — ИИ-ответы."""
    if _ai_support_enabled():
        return (
            "✨ <b>Поддержка</b>\n\n"
            "Пишите <b>прямо в этот чат</b> — мы на связи и готовы помочь.\n\n"
            "Отправьте <b>следующим сообщением</b> свой вопрос: оплата, подключение VPN (Happ) — "
            "дальше ответит помощник, и вы сможете продолжить с ним обычный диалог.\n\n"
            "<i>Закончить: кнопка ниже или /done</i>"
        )
    return (
        "✨ <b>Поддержка</b>\n\n"
        "Пишите <b>прямо в этот чат</b>.\n\n"
        "Автоответ помощника сейчас недоступен — попробуйте чуть позже, команда /status "
        "или кнопка «🛡 Подключить VPN» в главном меню (/start).\n\n"
        "<i>Закончить: кнопка ниже или /done</i>"
    )


def format_dt(dt_str: str | None) -> str:
    if not dt_str:
        return "неизвестно"
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%d.%m.%Y")
    except Exception:
        return dt_str


HELP_GENERAL = (
    "🛡 <b>Умный VPN Frosty — как подключить</b>\n"
    "\n"
    "<b>Что умеет Frosty:</b>\n"
    "• Instagram, TikTok, YouTube — через VPN автоматически\n"
    "• Маркетплейсы (WB, Ozon, Avito), банки (Сбер, Т-Банк, Альфа), Госуслуги, VK — напрямую без VPN\n"
    "• Реклама на YouTube — заблокирована\n"
    "• До 10 устройств на одной подписке\n"
    "• Без лимитов по скорости и трафику\n"
    "\n"
    "<b>Шаг 1 — Доступ</b>\n"
    "Возьми <b>бесплатный день</b> (кнопка в меню) или оплати подписку "
    "(Lava или ЮKassa) — доступ активируется мгновенно.\n"
    "\n"
    "<b>Шаг 2 — Скачай Happ</b>\n"
    '• Android: <a href="https://play.google.com/store/apps/details?id=com.happproxy">Google Play</a>\n'
    '• iOS: <a href="https://apps.apple.com/app/happ-proxy-utility/id6504287215">App Store</a>\n'
    '• Windows/Mac: <a href="https://hiddify.com">Hiddify</a>\n'
    "\n"
    "<b>Шаг 3 — Подключись одним нажатием</b>\n"
    "1. В боте нажми «🛡 Подключить VPN»\n"
    "2. Нажми «Открыть в Happ» — приложение добавит сервер само\n"
    "3. Или скопируй VPN-код и вставь в Happ через «+» → «Из буфера»\n"
    "\n"
    "━━━━━━━━━━━━━━━━\n"
    "❓ <b>Частые вопросы</b>\n"
    "\n"
    "<b>Сколько устройств?</b> До 10 на одном аккаунте\n"
    "<b>Лимит трафика?</b> Нет — скорость и трафик не ограничены\n"
    "<b>Как отменить автопродление?</b> Кнопка в главном меню бота или команда /status "
    "(сначала подтверждение, чтобы не нажать случайно).\n"
    "<b>Поддержка:</b> /support"
)


def help_kb() -> InlineKeyboardMarkup:
    """После /help: главное меню + поддержка (в основном меню кнопки поддержки нет)."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🆘 Поддержка (/support)", callback_data="menu:support")],
            [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
        ]
    )


class BackendError(RuntimeError):
    def __init__(self, status: int, body: str, path: str) -> None:
        super().__init__(f"backend {path} -> {status}: {body[:240]}")
        self.status = status
        self.body = body
        self.path = path


async def backend_get(session: aiohttp.ClientSession, path: str) -> dict[str, Any]:
    url = f"{BACKEND_BASE_URL}{path}"
    async with session.get(
        url,
        headers=_internal_headers(),
        timeout=aiohttp.ClientTimeout(total=10),
    ) as resp:
        raw = await resp.text()
        if resp.status >= 400:
            _log.warning("backend_get %s -> %s body=%s", path, resp.status, raw[:240])
            raise BackendError(resp.status, raw, path)
        try:
            import json as _json
            data = _json.loads(raw) if raw else {}
        except Exception as exc:
            raise BackendError(resp.status, raw, path) from exc
        if not isinstance(data, dict):
            raise BackendError(resp.status, raw, path)
        return data


async def backend_post(session: aiohttp.ClientSession, path: str, payload: dict[str, Any]) -> None:
    url = f"{BACKEND_BASE_URL}{path}"
    try:
        headers = {**_internal_headers(), "Content-Type": "application/json"}
        async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=5)):
            pass
    except Exception as exc:
        # FIX: Log failures instead of silently swallowing them — makes backend issues diagnosable
        _log.warning("backend_post %s failed: %s", path, exc)


async def backend_post_json(session: aiohttp.ClientSession, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{BACKEND_BASE_URL}{path}"
    headers = {**_internal_headers(), "Content-Type": "application/json"}
    async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
        data = await resp.json(content_type=None)
        if not isinstance(data, dict):
            raise RuntimeError("Unexpected backend response")
        return data


async def backend_cancel_recurring(
    session: aiohttp.ClientSession,
    telegram_id: int,
) -> tuple[int, dict[str, Any]]:
    """POST /bot/cancel-recurring — отмена автопродления (Lava +/− ЮKassa)."""
    url = f"{BACKEND_BASE_URL}/bot/cancel-recurring"
    headers = {**_internal_headers(), "Content-Type": "application/json"}
    async with session.post(
        url,
        json={"telegram_id": telegram_id},
        headers=headers,
        timeout=aiohttp.ClientTimeout(total=30),
    ) as resp:
        raw = await resp.text()
        try:
            data = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            data = {"error": "bad_response", "raw": raw[:240]}
        if not isinstance(data, dict):
            data = {}
        return resp.status, data


async def backend_grant_trial(
    session: aiohttp.ClientSession,
    telegram_id: int,
    username: str | None,
    first_name: str | None,
) -> tuple[int, dict[str, Any]]:
    """POST /bot/grant-trial — только с INTERNAL_API_TOKEN на бэкенде."""
    url = f"{BACKEND_BASE_URL}/bot/grant-trial"
    headers = {**_internal_headers(), "Content-Type": "application/json"}
    async with session.post(
        url,
        json={"telegram_id": telegram_id, "username": username, "first_name": first_name},
        headers=headers,
        timeout=aiohttp.ClientTimeout(total=20),
    ) as resp:
        raw = await resp.text()
        try:
            data = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            data = {"error": "bad_response", "raw": raw[:240]}
        if not isinstance(data, dict):
            data = {}
        return resp.status, data


async def backend_checkout_create(
    session: aiohttp.ClientSession,
    *,
    telegram_id: int,
    username: str | None,
    customer_email: str | None = None,
    payment_provider: str = "lava",
) -> tuple[int, dict[str, Any]]:
    """Создать оплату без mini-app: POST /checkout/create."""
    url = f"{BACKEND_BASE_URL}/checkout/create"
    headers = {"Content-Type": "application/json"}
    payload: dict[str, Any] = {
        "telegram_id": telegram_id,
        "username": username,
        "customer_email": customer_email,
        "payment_provider": payment_provider,
    }
    async with session.post(
        url,
        json=payload,
        headers=headers,
        timeout=aiohttp.ClientTimeout(total=20),
    ) as resp:
        raw = await resp.text()
        try:
            data = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            data = {"error": "bad_response", "raw": raw[:240]}
        if not isinstance(data, dict):
            data = {}
        return resp.status, data


def _normalize_payment_url_bot(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return u
    if u.startswith("//"):
        return "https:" + u
    low = u.lower()
    if low.startswith("http://") or low.startswith("https://"):
        return u
    rel = u.lstrip("/")
    if rel.lower().startswith("pay/") or rel.lower().startswith("pay?"):
        return f"https://lava.top/{rel}"
    return u


def _api_error_detail(payload: dict[str, Any]) -> str:
    """Текст ошибки из JSON FastAPI (detail: str | list[dict])."""
    raw = payload.get("detail", payload.get("details"))
    if isinstance(raw, str):
        return raw.strip()
    if isinstance(raw, list):
        msgs: list[str] = []
        for item in raw:
            if isinstance(item, dict):
                m = item.get("msg")
                if isinstance(m, str) and m.strip():
                    msgs.append(m.strip())
        return "\n".join(msgs).strip()
    return ""


async def _fetch_vpn_config(session: aiohttp.ClientSession, tg_id: int) -> dict:
    """Запрашивает /vpn/config/{tg_id} и возвращает dict с полями available/reason/vless_link/vless_link_alt."""
    try:
        return await backend_get(session, f"/vpn/config/{tg_id}")
    except Exception:
        return {}


async def _fetch_amnezia_config(session: aiohttp.ClientSession, tg_id: int) -> dict:
    try:
        return await backend_get(session, f"/vpn/amnezia/config/{tg_id}")
    except Exception:
        return {}


async def _send_amnezia_vpn(msg: Message, session: aiohttp.ClientSession, tg_uid: int) -> None:
    data = await _fetch_amnezia_config(session, tg_uid)
    if not data.get("available"):
        reason = data.get("reason")
        if reason == "no_key":
            text = (
                "🌿 <b>Amnezia VPN</b>\n\n"
                "Доступ для вас включён, но ключ ещё не выдан. Напишите администратору."
            )
        else:
            text = "Этот раздел недоступен для вашего аккаунта."
        await msg.answer(text, parse_mode="HTML", reply_markup=await main_menu_kb_for(session, tg_uid))
        return
    key = str(data.get("vpn_key") or "").strip()
    steps = data.get("install_steps") or []
    app_url = data.get("app_url") or "https://amnezia.org/ru"
    steps_txt = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(steps[:5]))
    body = (
        "🌿 <b>Amnezia VPN</b> — отдельный канал (лучше в РФ), не заменяет Frosty VLESS.\n\n"
        f"{steps_txt}\n\n"
        f"Скачать: <a href=\"{html.escape(app_url)}\">amnezia.org</a>\n\n"
        f"<code>{html.escape(key)}</code>"
    )
    await msg.answer(
        body,
        parse_mode="HTML",
        disable_web_page_preview=True,
        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="📋 Ключ Amnezia", callback_data="menu:amnezia_copy")],
                [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
            ]
        ),
    )


async def _get_vless_link(session: aiohttp.ClientSession, tg_id: int) -> tuple[str | None, str | None]:
    """Возвращает (vless_link, None) для Happ — вставка из буфера."""
    data = await _fetch_vpn_config(session, tg_id)
    if not data.get("available"):
        return None, None
    vless = data.get("vless_link")
    if not isinstance(vless, str) or not vless.strip():
        return None, None
    return vless.strip(), None


async def _send_proxy_vpn_bundle(message: Message, session: aiohttp.ClientSession, tg_uid: int) -> None:
    """Умный VPN — подключение через Happ. Дифференцированные сообщения по причине отказа."""
    data = await _fetch_vpn_config(session, tg_uid)
    if not data.get("available"):
        reason = data.get("reason", "")

        # Подписка приостановлена (renewal_failed, admin suspend)
        if reason == "suspended":
            await message.answer(
                "⚠️ <b>Доступ временно приостановлен</b>\n\n"
                "Возможные причины:\n"
                "• Не удалось списать оплату за автопродление\n"
                "• Подписка заблокирована администратором\n\n"
                "💳 Оплатите подписку чтобы восстановить доступ, или обратитесь в поддержку.",
                parse_mode="HTML",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="💳 Оплатить / продлить", callback_data="menu:buy_in_bot")],
                    [InlineKeyboardButton(text="💬 Поддержка", callback_data="menu:support")],
                    [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
                ]),
            )
            return

        # Нет подписки совсем
        if reason == "no_subscription":
            await message.answer(
                "❌ <b>Подписка не найдена</b>\n\n"
                "Оформите подписку чтобы получить доступ к VPN.\n"
                "Доступен бесплатный пробный день.",
                parse_mode="HTML",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="🎁 Бесплатный день", callback_data="menu:trial")],
                    [InlineKeyboardButton(text="💳 Купить подписку", callback_data="menu:buy_in_bot")],
                    [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
                ]),
            )
            return

        # VPN создаётся или временная ошибка API
        if reason == "creating":
            await message.answer(
                "⏳ <b>VPN создаётся</b>\n\n"
                "Подождите 10–20 секунд и нажмите «Обновить».",
                parse_mode="HTML",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="🔄 Обновить", callback_data="menu:connect")],
                    [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
                ]),
            )
            return

        # Неизвестная причина / пустой ответ — делаем ещё один попытку
        await asyncio.sleep(1.0)
        data = await _fetch_vpn_config(session, tg_uid)

    vless, _vless_alt = await _get_vless_link(session, tg_uid)
    if not vless:
        await message.answer(
            "⏳ <b>VPN ещё инициализируется</b>\n\n"
            "Подождите 15–20 секунд и нажмите «Обновить».\n"
            "Если проблема повторяется — напишите в поддержку.",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="🔄 Обновить", callback_data="menu:connect")],
                [InlineKeyboardButton(text="💬 Поддержка", callback_data="menu:support")],
                [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
            ]),
        )
        return

    await message.answer(
        "🛡 <b>Умный VPN Frosty</b>\n\n"
        "<b>Шаг 1.</b> Установите приложение Happ:\n"
        '• <a href="https://apps.apple.com/app/happ-proxy-utility/id6504287215">iOS (App Store)</a>\n'
        '• <a href="https://play.google.com/store/apps/details?id=com.happproxy">Android (Google Play)</a>\n'
        '• <a href="https://hiddify.com">Windows / Mac (Hiddify)</a>\n\n'
        "<b>Шаг 2.</b> Скопируйте VPN-ключ и вставьте в Happ: «+» → «Вставить из буфера»\n\n"
        f"<code>{html.escape(vless)}</code>\n\n"
        "⚡ Instagram, TikTok, YouTube — через VPN.\n"
        "До 10 устройств · без лимитов по скорости и трафику",
        parse_mode="HTML",
        disable_web_page_preview=True,
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📋 Скопировать VPN-код", callback_data="menu:copy_vpn")],
            [InlineKeyboardButton(text="🔄 Обновить данные", callback_data="menu:connect")],
            [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
        ]),
    )



def _buy_direct_kb(payment_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=f"💳 Оплатить {PRICE_RUB} ₽", url=payment_url)],
            [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
        ]
    )


async def _send_trial_direct_access(
    message: Message,
    session: aiohttp.ClientSession,
    *,
    tg_id: int,
    exp_human: str,
    already_active: bool,
) -> None:
    # Иногда XRAY отдаёт конфиг через 1-2 секунды после активации.
    vless_link, _vless_alt = await _get_vless_link(session, tg_id)
    if not vless_link:
        await asyncio.sleep(1.5)
        vless_link, _vless_alt = await _get_vless_link(session, tg_id)

    intro = "🎁 <b>Пробный период уже активен</b>" if already_active else "🎁 <b>Пробный день активирован!</b>"
    if vless_link:
        await message.answer(
            f"{intro}\n\n"
            f"Доступ до: <b>{exp_human}</b>\n\n"
            "Скопируйте VPN-ключ и вставьте в Happ: «+» → «Вставить из буфера»\n\n"
            f"<code>{html.escape(vless_link)}</code>\n\n"
            "❓ Нет Happ?\n"
            '<a href="https://apps.apple.com/app/happ-proxy-utility/id6504287215">iOS</a> · '
            '<a href="https://play.google.com/store/apps/details?id=com.happproxy">Android</a> · '
            '<a href="https://hiddify.com">Windows/Mac (Hiddify)</a>',
            parse_mode="HTML",
            disable_web_page_preview=True,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="📋 СКОПИРОВАТЬ VPN-КОД", callback_data="menu:trial_copy_vless")],
                [InlineKeyboardButton(text="💳 Купить полную подписку", callback_data="menu:buy_in_bot")],
                [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
            ]),
        )
        return

    await message.answer(
        f"{intro}\n\n"
        f"Доступ до: <b>{exp_human}</b>\n\n"
        "⏳ VPN ещё создаётся — нажмите «🛡 Подключить VPN» через 10–20 секунд.\n"
        "Если не появится — напишите в поддержку, выдадим вручную.",
        parse_mode="HTML",
        reply_markup=trial_direct_kb(tg_id, show_copy_button=False),
    )


async def show_cancel_autopay_button(session: aiohttp.ClientSession, tg_id: int) -> bool:
    """Кнопка отмены автопродления: только для активной платной (не trial) подписки без suspend."""
    try:
        data = await backend_get(session, f"/subscription/{tg_id}")
    except Exception:
        return False  # При ошибке API прячем кнопку, чтобы не вводить в заблуждение
    if not data.get("active") or data.get("suspended") or data.get("is_trial"):
        return False
    return True


def _get_session(dp: Dispatcher) -> aiohttp.ClientSession:
    """FIX: Centralised session access with a clear error if startup didn't complete."""
    session: aiohttp.ClientSession | None = dp.get("http_session")
    if session is None:
        raise RuntimeError("HTTP session is not initialised — on_startup may have failed")
    return session


# ── Handlers ──


async def send_grant_trial_result(
    message: Message,
    session: aiohttp.ClientSession,
    *,
    tg_id: int,
    username: str | None,
    first_name: str | None,
) -> None:
    status, data = await backend_grant_trial(session, tg_id, username, first_name)
    if status >= 400:
        detail = data.get("detail") if isinstance(data.get("detail"), str) else None
        _log.warning("grant_trial http %s: %s", status, data)
        await message.answer(
            detail
            or "Сервис временно не смог выдать пробный период. Попробуйте позже или оформите подписку в боте (Lava / ЮKassa).",
            reply_markup=main_menu_kb(tg_id),
        )
        return
    if not data.get("ok"):
        err = str(data.get("error") or "")
        if err == "trial_already_used":
            await message.answer(
                "🎁 <b>Пробный день уже был использован</b>\n\n"
                "Один бесплатный день на аккаунт Telegram — дальше только полная подписка.\n"
                "Оформите её в боте: «Купить / продлить подписку» — Lava или ЮKassa.",
                parse_mode="HTML",
                reply_markup=main_menu_kb(tg_id),
            )
            return
        if err == "already_subscribed":
            await message.answer(
                "✅ У вас уже есть активная подписка.\n\n"
                "Нажми «🛡 Подключить VPN» — один клик запустит Happ с готовым сервером.",
                reply_markup=main_menu_kb(tg_id),
            )
            return
        await message.answer(
            "Не получилось активировать пробный период. Попробуйте позже или напишите в /support.",
            reply_markup=main_menu_kb(tg_id),
        )
        return

    exp_raw = data.get("expires_at")
    exp_human = "скоро"
    if isinstance(exp_raw, str):
        exp_human = format_dt(exp_raw)
    if data.get("already_active"):
        await _send_trial_direct_access(
            message,
            session,
            tg_id=tg_id,
            exp_human=exp_human,
            already_active=True,
        )
        return
    await _send_trial_direct_access(
        message,
        session,
        tg_id=tg_id,
        exp_human=exp_human,
        already_active=False,
    )


async def cmd_start(message: Message, session: aiohttp.ClientSession, state: FSMContext) -> None:
    parts = (message.text or "").split(maxsplit=1)
    param = parts[1].strip() if len(parts) > 1 else ""

    tg_id = message.from_user.id if message.from_user else None
    username = message.from_user.username if message.from_user else None
    first_name = message.from_user.first_name if message.from_user else None
    if not tg_id:
        await message.answer("Не удалось определить ваш Telegram ID.", reply_markup=support_kb())
        return

    await state.clear()

    ref_source: str | None = None
    token: str = ""

    if param:
        if param.startswith("sub_"):
            pass  # handled below
        elif len(param) == 36 and "-" in param:
            # Deep link: payment token (UUID)
            token = param
        else:
            ref_source = param[:64]

    # Трекинг в фоне — не блокируем приветствие, если бэкенд долго отвечает или недоступен
    asyncio.create_task(
        backend_post(
            session,
            "/track-ref",
            {
                "telegram_id": tg_id,
                "username": username,
                "first_name": first_name,
                "ref_source": ref_source,
            },
        )
    )

    # Web-to-bot deep link: пользователь оплатил на сайте, теперь активирует в боте
    if param.startswith("sub_"):
        token_str = param[4:]
        valid = False
        try:
            UUID(token_str)
            valid = True
        except ValueError:
            pass

        if valid:
            try:
                data = await backend_post_json(
                    session,
                    "/subscription/claim-by-token",
                    {
                        "payment_token": token_str,
                        "telegram_id": tg_id,
                        "username": username,
                        "first_name": first_name,
                    },
                )
            except Exception:
                data = {}

            if data.get("ok"):
                await message.answer(
                    "🧊 <b>Frosty — умный VPN активирован!</b>\n\n"
                    "✅ Нажми «🛡 Подключить VPN» — и ты готов. Один клик открывает Happ с настроенным сервером.",
                    parse_mode="HTML",
                    reply_markup=await main_menu_kb_for(session, tg_id),
                )
                return
        # Некорректный или чужой токен — показываем обычный стартовый экран

    if token:
        try:
            data = await backend_get(session, f"/subscription/token/{token}")
        except Exception:
            await message.answer("Не удалось проверить оплату. Попробуйте позже.")
            return

        if data.get("found"):
            expires_at = format_dt(data.get("expires_at"))
            await message.answer(
                f"✅ Умный VPN Frosty активен до {expires_at}.\n\n"
                "Нажми «🛡 Подключить VPN» — всё настроится автоматически.",
                reply_markup=await main_menu_kb_for(session, tg_id),
            )
            return

    await message.answer(
        f"🧊 <b>Frosty — Умный VPN за {PRICE_RUB} ₽/мес</b>\n"
        "\n"
        "🛡 <b>Белые списки</b> — WB, Ozon, Avito, Сбер, Госуслуги, Яндекс, VK работают напрямую; "
        "Instagram, TikTok, YouTube — автоматически через VPN\n"
        "📱 <b>До 10 устройств</b> — телефон, планшет, ноутбук — все на одной подписке\n"
        "⚡ <b>Без лимитов</b> — никаких ограничений по скорости и трафику\n"
        "\n"
        f"<b>10 ₽/день · {PRICE_RUB} ₽/мес · Отмена в любой момент</b>\n\n"
        "🎁 Один <b>бесплатный день</b> — в меню ниже. Поддержка: /support",
        parse_mode="HTML",
        reply_markup=await main_menu_kb_for(session, tg_id),
    )


async def cmd_stop(message: Message, session: aiohttp.ClientSession) -> None:
    tg_id = message.from_user.id if message.from_user else 0
    if not tg_id:
        return
    await backend_post(session, "/marketing/opt-out", {"telegram_id": tg_id})
    await message.answer(
        "Ок, напоминания отключены.\n"
        "Сервис доступен как раньше — нажми /start если захочешь подключиться."
    )


async def cmd_status(message: Message, session: aiohttp.ClientSession, tg_id: int) -> None:
    try:
        data = await backend_get(session, f"/subscription/{tg_id}")
    except BackendError as exc:
        _log.warning("cmd_status: tg_id=%s backend %s (%s)", tg_id, exc.status, exc.path)
        if exc.status in (401, 403):
            hint = "Сервис временно в обслуживании (auth). Мы уже чиним."
        elif 500 <= exc.status < 600:
            hint = "Сервер подписок недоступен. Попробуйте через минуту."
        else:
            hint = "Не удалось получить статус. Попробуйте позже."
        await message.answer(hint, reply_markup=support_kb())
        return
    except Exception:
        _log.exception("cmd_status: tg_id=%s unexpected error", tg_id)
        await message.answer("Не удалось получить статус. Попробуйте позже.", reply_markup=support_kb())
        return

    if data.get("suspended"):
        expires_at_susp = format_dt(data.get("expires_at"))
        await message.answer(
            "⏸ <b>Доступ приостановлен</b>\n\n"
            "Возможные причины:\n"
            "• Не прошло автопродление (проблема с картой/счётом)\n"
            "• Администратор временно заблокировал доступ\n\n"
            f"📅 Оплачено до: {expires_at_susp}\n\n"
            "💳 Оплатите подписку вручную — доступ восстановится сразу.\n"
            "Или напишите в поддержку.",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="💳 Оплатить / продлить", callback_data="menu:buy_in_bot")],
                [InlineKeyboardButton(text="💬 Поддержка", callback_data="menu:support")],
            ]),
        )
        return

    if not data.get("active"):
        await message.answer(
            "🧊 <b>Умный VPN Frosty — подписка не активна</b>\n"
            "\n"
            "🛡 Белые списки · 📱 до 10 устройств · ⚡ без лимитов по скорости и трафику\n"
            "\n"
            f"<b>От {PRICE_RUB} ₽/мес</b> · 10 ₽/день · отмена в любой момент\n\n"
            "Оплата в боте (Lava / ЮKassa) или мини-апп — кнопки ниже.",
            parse_mode="HTML",
            reply_markup=main_menu_kb(tg_id),
        )
        return

    expires_at = format_dt(data.get("expires_at"))
    is_trial = bool(data.get("is_trial"))
    autopay_on = bool(data.get("autopay_enabled"))
    lava_autopay = bool(data.get("lava_autopay_enabled"))
    if is_trial:
        renew_line = f"🎁 <b>Пробный день</b> — затем {PRICE_RUB} ₽/мес\n"
        autopay_line = ""
    elif lava_autopay:
        renew_line = f"💳 Тариф: {PRICE_RUB} ₽/мес · 10 ₽/день\n"
        autopay_line = (
            "🔄 <b>Lava.top</b>: автопродление <b>включено</b>. Отключить — "
            "кнопка «Отменить автопродление» в меню.\n"
        )
    elif autopay_on:
        renew_line = f"💳 Тариф: {PRICE_RUB} ₽/мес · 10 ₽/день\n"
        autopay_line = "🔄 <b>ЮKassa</b>: автопродление включено. Отключить — кнопка ниже.\n"
    else:
        renew_line = f"💳 Тариф: {PRICE_RUB} ₽/мес · 10 ₽/день\n"
        autopay_line = "🔄 Автопродление не привязано — продление только вручную.\n"
    status_text = (
        f"✅ <b>Умный VPN активен</b>\n"
        f"\n"
        f"🛡 Нажми «Подключить VPN» — один клик запустит Happ\n"
        f"\n"
        f"📅 Действует до: {expires_at}\n"
        f"{renew_line}"
        f"{autopay_line}"
        f"📱 Устройств: до 10 на аккаунте\n"
        f"❓ Вопросы — /support"
    )
    await message.answer(
        status_text,
        parse_mode="HTML",
        reply_markup=main_menu_kb(tg_id),
    )


async def main() -> None:
    # On Railway the bot is disabled — only VPS instance polls Telegram.
    # Prevents TelegramConflictError from two simultaneous getUpdates.
    if os.getenv("RAILWAY_ENVIRONMENT"):
        import asyncio as _asyncio
        _log.info("RAILWAY_ENVIRONMENT detected — bot polling disabled on Railway. VPS instance is primary.")
        await _asyncio.sleep(float("inf"))
        return

    if not BOT_TOKEN:
        raise SystemExit("BOT_TOKEN is missing. Create bot/.env from bot/.env.example")

    logging.basicConfig(level=logging.INFO)

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())

    async def on_startup(**kwargs: Any) -> None:
        dp["http_session"] = aiohttp.ClientSession()
        _log.info(
            "Support AI: enabled=%s (OPENROUTER key set=%s, OPENAI key set=%s, SUPPORT_AI_ENABLED=%r)",
            _ai_support_enabled(),
            bool(os.getenv("OPENROUTER_API_KEY", "").strip()),
            bool(os.getenv("OPENAI_API_KEY", "").strip()),
            os.getenv("SUPPORT_AI_ENABLED", ""),
        )
        try:
            import support_ai as _sa

            _log.info(
                "support_ai: import OK, llm_api_key len=%s",
                len(_sa.llm_api_key()),
            )
        except Exception as e:
            _log.error("support_ai: import FAILED (fix Railway Root Directory=bot or PYTHONPATH): %s", e)
        try:
            await bot.set_chat_menu_button(menu_button=MenuButtonDefault())
        except Exception:
            pass
        try:
            await bot.set_my_description(
                description=(
                    f"Frosty — умный VPN за {PRICE_RUB} ₽/мес. "
                    "Белые списки: РФ-сайты напрямую, Instagram/TikTok/YouTube — через VPN. "
                    "До 10 устройств, без лимитов по скорости и трафику."
                )
            )
            await bot.set_my_short_description(
                short_description=f"Умный VPN с белыми списками. {PRICE_RUB} ₽/мес."
            )
        except Exception:
            pass
        _log.info("Bot started")

    async def on_shutdown(**kwargs: Any) -> None:
        session: aiohttp.ClientSession | None = dp.get("http_session")
        if session:
            await session.close()

    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    @dp.message(CommandStart())
    async def _start(message: Message, state: FSMContext) -> None:
        session = _get_session(dp)
        await cmd_start(message, session, state)

    @dp.message(Command("status"))
    async def _status(message: Message) -> None:
        session = _get_session(dp)
        tg_id = message.from_user.id if message.from_user else 0
        await cmd_status(message, session, tg_id)

    @dp.message(Command("trial"))
    async def _trial(message: Message) -> None:
        session = _get_session(dp)
        tg_id = message.from_user.id if message.from_user else 0
        if not tg_id:
            await message.answer("Не удалось определить ваш Telegram ID.")
            return
        await send_grant_trial_result(
            message,
            session,
            tg_id=tg_id,
            username=message.from_user.username if message.from_user else None,
            first_name=message.from_user.first_name if message.from_user else None,
        )

    @dp.message(Command("help"))
    async def _help(message: Message) -> None:
        await message.answer(HELP_GENERAL, parse_mode="HTML", reply_markup=help_kb())

    @dp.message(Command("aistatus"))
    async def _aistatus(message: Message) -> None:
        """Диагностика ИИ-поддержки (только BOT_ADMIN_TELEGRAM_IDS)."""
        uid = message.from_user.id if message.from_user else 0
        admins = _bot_admin_ids()
        if not admins or uid not in admins:
            return
        text = _support_ai_diagnostic_text()
        await message.answer(f"<pre>{html.escape(text)}</pre>", parse_mode="HTML")

    @dp.message(Command("bdb"))
    async def _bdb(message: Message) -> None:
        """
        Диагностика подписки через бот (только BOT_ADMIN_TELEGRAM_IDS).
        /bdb           — по себе
        /bdb <tg_id>   — по конкретному пользователю
        """
        uid = message.from_user.id if message.from_user else 0
        admins = _bot_admin_ids()
        if not admins or uid not in admins:
            return
        parts = (message.text or "").split(maxsplit=1)
        target = uid
        if len(parts) > 1:
            raw = parts[1].strip()
            try:
                target = int(raw.lstrip("@"))
            except ValueError:
                await message.answer("Нужен числовой telegram_id: <code>/bdb 123456789</code>", parse_mode="HTML")
                return

        session = _get_session(dp)
        lines: list[str] = [
            f"BACKEND_BASE_URL={BACKEND_BASE_URL}",
            f"INTERNAL_API_TOKEN set={bool(INTERNAL_API_TOKEN)}",
            f"target_tg_id={target}",
        ]

        try:
            sub = await backend_get(session, f"/subscription/{target}")
            lines.append(f"/subscription -> {sub}")
        except BackendError as e:
            lines.append(f"/subscription FAILED {e.status}: {e.body[:200]}")
        except Exception as e:
            lines.append(f"/subscription EXC {e!r}")

        try:
            diag = await backend_get(session, f"/internal/diag/subscription/{target}")
            lines.append(f"/internal/diag -> {diag}")
        except BackendError as e:
            lines.append(f"/internal/diag FAILED {e.status}: {e.body[:200]}")
        except Exception as e:
            lines.append(f"/internal/diag EXC {e!r}")

        text = "\n\n".join(lines)
        if len(text) > 3800:
            text = text[-3800:]
        await message.answer(f"<pre>{html.escape(text)}</pre>", parse_mode="HTML")

    @dp.message(Command("stop"))
    async def _stop(message: Message) -> None:
        session = _get_session(dp)
        await cmd_stop(message, session)

    @dp.callback_query(lambda c: c.data == "marketing:optout")
    async def _marketing_optout(query: CallbackQuery) -> None:
        session = _get_session(dp)
        await backend_post(session, "/marketing/opt-out", {"telegram_id": query.from_user.id})
        await query.answer("Отписали от напоминаний.")
        msg = query.message
        if msg and isinstance(msg, Message):
            await msg.answer("Готово — рассылки отключены. Вернуться можно через /start.")

    @dp.callback_query(lambda c: (c.data or "").startswith("checkout:prov:"))
    async def _checkout_pick_provider(query: CallbackQuery, state: FSMContext) -> None:
        msg = query.message
        if not msg or not isinstance(msg, Message):
            await query.answer()
            return
        raw = (query.data or "").split(":")
        prov_code = raw[2] if len(raw) > 2 else "lava"
        prov = "yookassa" if prov_code == "yookassa" else "lava"
        await state.clear()
        await state.update_data(checkout_provider=prov)
        await state.set_state(CheckoutStates.waiting_email)
        label = "Lava.top" if prov == "lava" else "ЮKassa"
        await query.answer(f"Выбрано: {label}")
        await msg.answer(
            f"Оплата: <b>{label}</b>.\n\n"
            "Отправьте <b>одним сообщением</b> email для чека, например: <code>you@mail.ru</code>",
            parse_mode="HTML",
        )

    @dp.callback_query(lambda c: (c.data or "").startswith("menu:"))
    async def _menu(query: CallbackQuery, state: FSMContext) -> None:
        session = _get_session(dp)
        action = (query.data or "").split(":", 1)[1] if query.data else ""
        msg = query.message
        if not msg or not isinstance(msg, Message):
            await query.answer()
            return

        if action == "main":
            tg_id = query.from_user.id
            await msg.answer(
                "Выбери действие:",
                reply_markup=await main_menu_kb_for(session, tg_id),
            )
            await query.answer()
            return

        if action == "amnezia":
            await query.answer("Amnezia VPN…")
            tg_uid = query.from_user.id if query.from_user else 0
            await _send_amnezia_vpn(msg, session, tg_uid)
            return

        if action == "amnezia_copy":
            await query.answer("Ключ Amnezia…")
            tg_uid = query.from_user.id
            data = await _fetch_amnezia_config(session, tg_uid)
            key = str(data.get("vpn_key") or "").strip()
            if not key:
                await msg.answer(
                    "Ключ Amnezia ещё не выдан. Напишите администратору.",
                    reply_markup=await main_menu_kb_for(session, tg_uid),
                )
                return
            await msg.answer(
                f"Скопируйте ключ и вставьте в AmneziaVPN:\n\n<code>{html.escape(key)}</code>",
                parse_mode="HTML",
                reply_markup=InlineKeyboardMarkup(
                    inline_keyboard=[
                        [InlineKeyboardButton(text="🌿 Amnezia VPN", callback_data="menu:amnezia")],
                        [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
                    ]
                ),
            )
            return

        if action in ("buy_in_bot", "subscribe"):
            await query.answer()
            tg_uid = query.from_user.id
            await state.clear()
            head = (
                "💳 <b>Оплата в боте</b>\n\n"
                if action == "buy_in_bot"
                else "💳 <b>Оформление подписки</b>\n\n"
            )
            await msg.answer(
                head
                + "Выберите способ оплаты — затем отправьте <b>email для чека</b> "
                "(нужен и для Lava, и для ЮKassa).",
                parse_mode="HTML",
                reply_markup=checkout_provider_kb(tg_uid),
            )
            return

        if action == "help":
            await msg.answer(HELP_GENERAL, parse_mode="HTML", reply_markup=help_kb())
            await query.answer()
            return

        if action == "trial":
            await query.answer()
            await send_grant_trial_result(
                msg,
                session,
                tg_id=query.from_user.id,
                username=query.from_user.username if query.from_user else None,
                first_name=query.from_user.first_name if query.from_user else None,
            )
            return

        if action in ("connect", "get_proxy", "get_vpn"):
            await query.answer("Проверяю доступ…")
            tg_uid = query.from_user.id if query.from_user else 0
            try:
                await _send_proxy_vpn_bundle(msg, session, tg_uid)
            except Exception as exc:
                _log.exception("_send_proxy_vpn_bundle failed tg_id=%s: %s", tg_uid, exc)
                await msg.answer(
                    "Не удалось загрузить VPN-данные. Попробуйте через минуту или напишите /support.",
                    reply_markup=await main_menu_kb_for(session, tg_uid),
                )
            return

        if action == "copy_vpn":
            await query.answer("Отправляю код для копирования")
            tg_uid = query.from_user.id
            vless, _ = await _get_vless_link(session, tg_uid)
            if not vless:
                await msg.answer(
                    "Код пока не получен. Нажмите «🛡 Подключить VPN» снова через 10–20 секунд.",
                    reply_markup=await main_menu_kb_for(session, tg_uid),
                )
                return
            await msg.answer(
                f"Скопируйте строку ниже и вставьте в Happ:\n\n<code>{html.escape(vless)}</code>",
                parse_mode="HTML",
                reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text="🛡 Подключить VPN", callback_data="menu:connect")],
                    [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
                ]),
            )
            return

        if action == "trial_copy_vless":
            await query.answer("Готовлю код…")
            tg_uid = query.from_user.id
            vless, _ = await _get_vless_link(session, tg_uid)
            if not vless:
                await msg.answer(
                    "Код ещё не готов. Подождите 10–20 секунд и нажмите кнопку снова или /status.",
                    reply_markup=trial_direct_kb(tg_uid, show_copy_button=False),
                )
                return
            await msg.answer(
                f"Скопируйте этот код и вставьте в Happ:\n\n<code>{html.escape(vless)}</code>",
                parse_mode="HTML",
                reply_markup=trial_direct_kb(tg_uid, show_copy_button=True),
            )
            return

        if action == "status":
            await cmd_status(msg, session, tg_id=query.from_user.id)
            await query.answer()
            return

        if action == "support":
            await state.set_state(SupportStates.chatting)
            tg_uid = query.from_user.id
            sc = await show_cancel_autopay_button(session, tg_uid)
            await state.update_data(support_history=[], support_show_cancel=sc)
            await query.answer()
            await msg.answer(
                support_invite_html(),
                parse_mode="HTML",
                reply_markup=support_chat_kb(show_cancel_autopay=sc),
            )
            return

        if action == "cancel_recurring":
            await query.answer()
            await msg.answer(
                CANCEL_RECURRING_CONFIRM_HTML,
                parse_mode="HTML",
                reply_markup=cancel_recurring_confirm_kb(),
            )
            return

        if action == "cancel_recurring:no":
            await query.answer("Ок")
            tg_uid = query.from_user.id
            in_support = (await state.get_state()) == SupportStates.chatting.state
            if in_support:
                sdata = await state.get_data()
                sc = bool(sdata.get("support_show_cancel", True))
                await msg.answer("Оставляем автопродление как есть.", reply_markup=support_chat_kb(show_cancel_autopay=sc))
            else:
                await msg.answer(
                    "Оставляем автопродление как есть.",
                    reply_markup=await main_menu_kb_for(session, tg_uid),
                )
            return

        if action == "cancel_recurring:ok":
            await query.answer()
            tg_uid = query.from_user.id
            status, data = await backend_cancel_recurring(session, tg_uid)
            text: str
            ok = status == 200 and data.get("ok")
            if ok:
                text = str(data.get("message") or "Автопродление отменено.")
            elif status == 403:
                text = "Сервис временно не может выполнить запрос. Напишите текстом «отменить подписку» — администратор поможет."
            else:
                text = str(
                    data.get("message")
                    or data.get("error")
                    or "Не удалось отменить автопродление. Напишите в чат, мы разберёмся."
                )
            in_support = (await state.get_state()) == SupportStates.chatting.state
            sc = await show_cancel_autopay_button(session, tg_uid)
            if in_support:
                await state.update_data(support_show_cancel=sc)
                reply_kb = support_chat_kb(show_cancel_autopay=sc)
            else:
                reply_kb = await main_menu_kb_for(session, tg_uid)
            await msg.answer(text, reply_markup=reply_kb)
            return

        if action == "exit_support":
            await state.clear()
            await query.answer("Чат закрыт")
            tg_id = query.from_user.id
            await msg.answer(
                "Диалог закрыт. Снова поддержка: команда /support. Главное меню: /start.",
                reply_markup=await main_menu_kb_for(session, tg_id),
            )
            return

        await query.answer()

    @dp.message(Command("support"))
    async def _cmd_support(message: Message, state: FSMContext) -> None:
        session = _get_session(dp)
        tg_id = message.from_user.id if message.from_user else 0
        sc = await show_cancel_autopay_button(session, tg_id) if tg_id else True
        await state.set_state(SupportStates.chatting)
        await state.update_data(support_history=[], support_show_cancel=sc)
        await message.answer(
            support_invite_html(),
            parse_mode="HTML",
            reply_markup=support_chat_kb(show_cancel_autopay=sc),
        )

    @dp.message(StateFilter(CheckoutStates.waiting_email), F.text, _TextNotCommand())
    async def _checkout_email(message: Message, state: FSMContext) -> None:
        session = _get_session(dp)
        tg_id = message.from_user.id if message.from_user else 0
        email = (message.text or "").strip().lower()
        if not tg_id:
            await state.clear()
            return
        if not email or "@" not in email or "." not in email.split("@")[-1]:
            await message.answer(
                "Нужен корректный email для чека. Пример: <code>you@mail.ru</code>",
                parse_mode="HTML",
            )
            return
        data = await state.get_data()
        provider = str(data.get("checkout_provider") or "lava")
        await message.answer("Создаю ссылку оплаты…")
        status, payload = await backend_checkout_create(
            session,
            telegram_id=tg_id,
            username=message.from_user.username if message.from_user else None,
            customer_email=email,
            payment_provider=provider,
        )
        payment_url = _normalize_payment_url_bot(str(payload.get("payment_url") or ""))
        if status >= 400 or not payment_url:
            detail = _api_error_detail(payload)
            hint = ""
            if status == 503 and provider == "yookassa":
                hint = (
                    "\n\nЕсли ЮKassa на сервере ещё не настроена, выберите оплату через <b>Lava</b> "
                    "(снова «Купить / продлить подписку»)."
                )
            await message.answer(
                "Не удалось создать оплату. Попробуйте ещё раз или напишите в /support."
                + (f"\n\n{detail}" if detail else "")
                + hint,
                parse_mode="HTML",
                reply_markup=main_menu_kb(tg_id),
            )
            await state.clear()
            return
        await message.answer(
            "💳 <b>Оплата готова</b>\n\n"
            f"Тариф: <b>{PRICE_RUB} ₽/мес</b>\n"
            "Нажмите кнопку ниже, чтобы открыть оплату.",
            parse_mode="HTML",
            reply_markup=_buy_direct_kb(payment_url),
        )
        await state.clear()

    @dp.message(Command("done"), StateFilter(SupportStates.chatting))
    async def _cmd_done(message: Message, state: FSMContext) -> None:
        await state.clear()
        tg_id = message.from_user.id if message.from_user else 0
        await message.answer(
            "Диалог закрыт. Поддержка снова: /support. Главное меню: /start.",
            reply_markup=main_menu_kb(tg_id),
        )

    @dp.message(Command("reset"), StateFilter(SupportStates.chatting))
    async def _cmd_reset(message: Message, state: FSMContext) -> None:
        """Очищает контекст диалога с ИИ, не выходя из чата поддержки."""
        data = await state.get_data()
        sc = bool(data.get("support_show_cancel", True))
        await state.update_data(support_history=[])
        await message.answer(
            "Контекст очищен. Опишите вопрос заново — продолжаем в этом чате.",
            reply_markup=support_chat_kb(show_cancel_autopay=sc),
        )

    @dp.message(StateFilter(SupportStates.chatting), F.text, _TextNotCommand())
    async def _support_ai_message(message: Message, state: FSMContext) -> None:
        t = (message.text or "").strip()
        tg_id = message.from_user.id if message.from_user else 0
        if not tg_id:
            return
        ai_on = _ai_support_enabled()
        _log.info(
            "support: tg_id=%s ai_enabled=%s openrouter_key=%s support_ai_enabled_env=%r",
            tg_id,
            ai_on,
            bool(os.getenv("OPENROUTER_API_KEY", "").strip()),
            os.getenv("SUPPORT_AI_ENABLED", ""),
        )
        if ai_on:
            session = _get_session(dp)
            try:
                await message.bot.send_chat_action(message.chat.id, "typing")
            except Exception:
                pass
            from support_ai import SUPPORT_AI_MODEL, run_support_reply

            data = await state.get_data()
            sc_chat = bool(data.get("support_show_cancel", True))
            history_raw = data.get("support_history") or []
            history: list[dict[str, Any]] = history_raw if isinstance(history_raw, list) else []
            started_at = time.monotonic()
            reply_ok = True
            reply_err: str | None = None
            try:
                reply, new_history = await run_support_reply(session, tg_id, t, history)
            except Exception as exc:
                _log.exception("support_ai.run_support_reply failed tg_id=%s", tg_id)
                reply = "Помощник временно недоступен. Попробуйте ещё раз через минуту."
                new_history = history
                reply_ok = False
                reply_err = str(exc)[:500]
                await message.answer(reply, reply_markup=support_chat_kb(show_cancel_autopay=sc_chat))
            else:
                await message.answer(reply, reply_markup=support_chat_kb(show_cancel_autopay=sc_chat))
            finally:
                duration_ms = int((time.monotonic() - started_at) * 1000)
                await state.update_data(support_history=new_history)
                _log.info("support_ai: reply sent tg_id=%s len=%s ms=%s ok=%s", tg_id, len(reply), duration_ms, reply_ok)
                uname = message.from_user.username if message.from_user else None
                asyncio.create_task(
                    backend_post(
                        session,
                        "/internal/support/message",
                        {
                            "telegram_id": int(tg_id),
                            "username": uname,
                            "user_text": t[:4096],
                            "assistant_text": reply[:4096],
                            "model": SUPPORT_AI_MODEL,
                            "duration_ms": duration_ms,
                            "ok": reply_ok,
                            "error": reply_err,
                        },
                    )
                )
            return

        data = await state.get_data()
        sc_chat = bool(data.get("support_show_cancel", True))
        await message.answer(
            "Сообщение получено. Автоответ помощника сейчас недоступен — "
            "попробуйте позже, /status или «Купить / продлить подписку» в /start.",
            reply_markup=support_chat_kb(show_cancel_autopay=sc_chat),
        )

    @dp.message(StateFilter(SupportStates.chatting))
    async def _support_non_text(message: Message, state: FSMContext) -> None:
        data = await state.get_data()
        sc_chat = bool(data.get("support_show_cancel", True))
        await message.answer(
            "Пока принимаем только текст — напишите вопрос прямо в этот чат сообщением.",
            reply_markup=support_chat_kb(show_cancel_autopay=sc_chat),
        )

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
