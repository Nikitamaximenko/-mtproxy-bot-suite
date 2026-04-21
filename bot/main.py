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


def main_menu_kb(tg_id: int) -> InlineKeyboardMarkup:
    row3 = [
        InlineKeyboardButton(text="✅ Статус", callback_data="menu:status"),
        # Всегда чат в боте — не открываем личку по url (t.me)
        InlineKeyboardButton(text="🆘 Поддержка", callback_data="menu:support"),
    ]
    row_cancel = [
        InlineKeyboardButton(
            text="🚫 Отменить автопродление",
            callback_data="menu:cancel_recurring",
        ),
    ]
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🧊 2 в 1 — Прокси + VPN", web_app=WebAppInfo(url=_miniapp_url(tg_id)))],
        [InlineKeyboardButton(text="🎁 Бесплатный день", callback_data="menu:trial")],
        [InlineKeyboardButton(text="ℹ️ Инструкция", callback_data="menu:help")],
        row3,
        row_cancel,
    ])


def status_active_kb(tg_id: int) -> InlineKeyboardMarkup:
    """Активная подписка: прокси + VPN в мини-приложении."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🧊 Личный кабинет — 2 в 1",
                    web_app=WebAppInfo(url=_miniapp_url(tg_id)),
                )
            ],
            [
                InlineKeyboardButton(
                    text="🚫 Отменить автопродление",
                    callback_data="menu:cancel_recurring",
                )
            ],
            [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
        ]
    )


def support_kb() -> InlineKeyboardMarkup | None:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="🆘 Поддержка", callback_data="menu:support")]]
    )


def support_chat_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚫 Отменить автопродление",
                    callback_data="menu:cancel_recurring",
                )
            ],
            [InlineKeyboardButton(text="✖️ Закрыть чат", callback_data="menu:exit_support")],
        ]
    )


def support_invite_html() -> str:
    """Текст после нажатия «Поддержка»: диалог в боте; при наличии ключа LLM — ИИ-ответы."""
    if _ai_support_enabled():
        return (
            "✨ <b>Поддержка</b>\n\n"
            "Пишите <b>прямо в этот чат</b> — мы на связи и готовы помочь.\n\n"
            "Отправьте <b>следующим сообщением</b> свой вопрос: оплата, настройка VPN (Happ) — дальше ответит помощник, "
            "и вы сможете продолжить с ним обычный диалог.\n\n"
            "<i>Закончить: кнопка ниже или /done</i>"
        )
    return (
        "✨ <b>Поддержка</b>\n\n"
        "Пишите <b>прямо в этот чат</b>.\n\n"
        "Автоответ помощника сейчас недоступен — попробуйте чуть позже или проверьте раздел "
        "<b>«Статус»</b> и мини-приложение для оплаты/настроек.\n\n"
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
    "🛡 <b>Как подключить VPN через Happ</b>\n"
    "\n"
    "<b>Шаг 1 — Доступ</b>\n"
    "Один раз можно взять <b>бесплатный день</b> (кнопка в меню) или сразу оформить подписку в мини-приложении — оплата банковской картой.\n"
    "Доступ активируется автоматически.\n"
    "\n"
    "<b>Шаг 2 — Скачай Happ</b>\n"
    '• Android: <a href="https://play.google.com/store/apps/details?id=com.happproxy">Google Play</a>\n'
    '• iOS: <a href="https://apps.apple.com/app/happ-proxy-utility/id6504287215">App Store</a>\n'
    '• Windows/Mac: <a href="https://hiddify.com">Hiddify</a>\n'
    "\n"
    "<b>Шаг 3 — Подключись</b>\n"
    "1. Открой личный кабинет → вкладка «🛡 VPN»\n"
    "2. Нажми «Открыть в Happ» или скопируй ссылку\n"
    "3. В Happ вставь ссылку через «+» → «Из буфера»\n"
    "4. Нажми «Подключить» — готово ✅\n"
    "\n"
    "━━━━━━━━━━━━━━━━\n"
    "❓ <b>Частые вопросы</b>\n"
    "\n"
    "<b>Сколько устройств?</b> До 10 на одном аккаунте\n"
    "<b>Лимит трафика?</b> Нет — скорость и трафик не ограничены\n"
    "<b>Как отменить?</b> Напишите в поддержку через бота (кнопка «Поддержка»)"
)


def help_kb() -> InlineKeyboardMarkup:
    """Клавиатура под инструкцией: кнопка возврата в главное меню + быстрый
    переход в поддержку. Без них экран help был «тупиком» — юзер не мог
    вернуться назад из инструкции без ручного ввода команды."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🆘 Поддержка", callback_data="menu:support")],
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


def _parse_proxy_link(link: str) -> tuple[str, str, str]:
    from urllib.parse import parse_qs, urlparse
    parsed = urlparse(link)
    params = parse_qs(parsed.query)
    return (
        params.get("server", ["—"])[0],
        params.get("port", ["—"])[0],
        params.get("secret", ["—"])[0],
    )


def _manual_setup_text(server: str, port: str, secret: str) -> str:
    return (
        "<b>Настройка подключения в Telegram</b>\n"
        "\n"
        "<b>На смартфоне (Android / iOS)</b>\n"
        "1. Откройте Telegram → <b>Настройки → Данные и память → Прокси</b>\n"
        "2. Включите «Использовать прокси» → «Добавить прокси» → <b>MTProto</b>\n"
        "3. Введите:\n"
        f"   • <b>Сервер:</b> <code>{server}</code>\n"
        f"   • <b>Порт:</b> <code>{port}</code>\n"
        f"   • <b>Секрет:</b> <code>{secret}</code>\n"
        "4. Сохраните\n"
        "\n"
        "<b>На компьютере (Telegram Desktop)</b>\n"
        "1. <b>Настройки → Дополнительно → Тип соединения</b>\n"
        "2. Выберите «Использовать прокси (MTProto)»\n"
        "3. Введите те же данные и сохраните"
    )


async def _get_proxy_link(session: aiohttp.ClientSession, tg_id: int) -> str | None:
    try:
        data = await backend_get(session, f"/subscription/{tg_id}")
    except Exception:
        return None
    if not data.get("active"):
        return None
    return data.get("proxy_link") or None


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
            or "Сервис временно не смог выдать пробный период. Попробуйте позже или оформите подписку в мини-приложении.",
            reply_markup=main_menu_kb(tg_id),
        )
        return
    if not data.get("ok"):
        err = str(data.get("error") or "")
        if err == "trial_already_used":
            await message.answer(
                "🎁 <b>Пробный день уже был использован</b>\n\n"
                "Один бесплатный день на аккаунт Telegram — дальше только полная подписка.\n"
                "Оформите её в мини-приложении.",
                parse_mode="HTML",
                reply_markup=InlineKeyboardMarkup(
                    inline_keyboard=[
                        [
                            InlineKeyboardButton(
                                text="🧊 Оформить подписку",
                                web_app=WebAppInfo(url=_miniapp_url(tg_id)),
                            )
                        ],
                        [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
                    ]
                ),
            )
            return
        if err == "already_subscribed":
            await message.answer(
                "✅ У вас уже есть активная подписка.\n\nОткройте личный кабинет:",
                reply_markup=status_active_kb(tg_id),
            )
            return
        await message.answer(
            "Не получилось активировать пробный период. Попробуйте позже или напишите в поддержку.",
            reply_markup=main_menu_kb(tg_id),
        )
        return

    exp_raw = data.get("expires_at")
    exp_human = "скоро"
    if isinstance(exp_raw, str):
        exp_human = format_dt(exp_raw)
    if data.get("already_active"):
        await message.answer(
            f"🎁 <b>Пробный период уже активен</b> до <b>{exp_human}</b>\n\n"
            "Личный кабинет — кнопка ниже.",
            parse_mode="HTML",
            reply_markup=status_active_kb(tg_id),
        )
        return
    await message.answer(
        f"🎁 <b>Пробный день активирован!</b>\n\n"
        f"Доступ до: <b>{exp_human}</b>\n\n"
        "📡 MTProxy для Telegram и 🛡 VPN — в личном кабинете. "
        "Когда срок закончится, оформите подписку, чтобы не потерять доступ.",
        parse_mode="HTML",
        reply_markup=status_active_kb(tg_id),
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
                    "🧊 <b>Frosty — подписка 2 в 1 активирована!</b>\n\n"
                    "✅ Прокси для Telegram и VPN — в личном кабинете (кнопка ниже).",
                    parse_mode="HTML",
                    reply_markup=status_active_kb(tg_id),
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
                f"✅ Подписка 2 в 1 активна до {expires_at}.\n\n"
                "📡 Прокси и 🛡 VPN — в личном кабинете, нажми кнопку ниже.",
                reply_markup=status_active_kb(tg_id),
            )
            return

    await message.answer(
        f"🧊 <b>Frosty — 2 в 1 за {PRICE_RUB} ₽/мес</b>\n"
        "\n"
        "📡 <b>MTProxy</b> — Telegram без ограничений, отдельные приложения не нужны\n"
        "🛡 <b>VPN</b> — Instagram, TikTok, YouTube и любые сайты\n"
        "\n"
        "<b>Персональный доступ</b> — только ты на своём канале, без чужих пользователей.\n"
        "\n"
        f"<b>10 ₽/день · {PRICE_RUB} ₽/мес · Отмена в любой момент</b>\n\n"
        f"🎁 Один <b>бесплатный день</b> — кнопка в меню ниже (только здесь, в боте).",
        parse_mode="HTML",
        reply_markup=main_menu_kb(tg_id),
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
        await message.answer(
            "⏸ <b>Доступ приостановлен</b>\n\n"
            "Оплата прошла, но доступ временно снят администратором. "
            "Напиши в поддержку — восстановим по оплаченному периоду без сдвига дат.",
            parse_mode="HTML",
            reply_markup=support_kb(),
        )
        return

    if not data.get("active"):
        await message.answer(
            "🧊 <b>Подписка 2 в 1 не активна</b>\n"
            "\n"
            "Одна подписка: 📡 Telegram через MTProxy и 🛡 VPN для Instagram, TikTok, YouTube — "
            "персональный канал, без лимита трафика.\n"
            "\n"
            f"<b>От {PRICE_RUB} ₽/мес</b> · 10 ₽/день · отмена через поддержку",
            parse_mode="HTML",
            reply_markup=InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="🧊 Оформить 2 в 1", web_app=WebAppInfo(url=_miniapp_url(tg_id)))],
                    [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
                ]
            ),
        )
        return

    expires_at = format_dt(data.get("expires_at"))
    is_trial = bool(data.get("is_trial"))
    proxy_link = data.get("proxy_link")
    status_text = (
        f"✅ <b>Подписка 2 в 1 активна</b>\n"
        f"\n"
        f"📡 MTProxy для Telegram — в <b>личном кабинете</b> (вкладка «Telegram»)\n"
        f"🛡 VPN — там же (вкладка «VPN»), кнопка ниже\n"
        f"\n"
        f"📅 Действует до: {expires_at}\n"
        + (
            f"🎁 <b>Пробный день</b> — затем {PRICE_RUB} ₽/мес\n"
            if is_trial
            else f"💳 Тариф: {PRICE_RUB} ₽/мес · 10 ₽/день\n"
        )
        + f"🖥 Устройств: до 10 на аккаунте\n"
        f"❓ Отмена — через кнопку «Поддержка» в боте"
    )
    if not proxy_link:
        status_text += (
            "\n\n"
            "⚠️ Доступ в кабинете ещё полностью не подгрузился. "
            "Если нет прокси или VPN — напиши в поддержку."
        )
    await message.answer(status_text, parse_mode="HTML", reply_markup=status_active_kb(tg_id))


async def main() -> None:
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
                    f"Frosty — 2 в 1 за {PRICE_RUB} ₽/мес: MTProxy для Telegram и VPN (VLESS) для сайтов. "
                    "Персональный канал, до 10 устройств."
                )
            )
            await bot.set_my_short_description(
                short_description=f"2 в 1: прокси для Telegram + VPN. От {PRICE_RUB} ₽/мес."
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
                reply_markup=main_menu_kb(tg_id),
            )
            await query.answer()
            return

        if action == "subscribe":
            tg_id = query.from_user.id
            await query.answer()
            await msg.answer(
                f"<b>Frosty — 2 в 1</b> — <b>10 ₽/день</b> ({PRICE_RUB} ₽/мес).\n\n"
                "📡 <b>MTProxy</b> — Telegram без блокировок\n"
                "🛡 <b>VPN</b> — Instagram, TikTok, YouTube и любые сайты\n\n"
                "Нажми кнопку — оплата откроется прямо в Telegram.",
                parse_mode="HTML",
                reply_markup=InlineKeyboardMarkup(
                    inline_keyboard=[
                        [
                            InlineKeyboardButton(
                                text="💳 Оформить 2 в 1",
                                web_app=WebAppInfo(url=_miniapp_url(tg_id)),
                            )
                        ],
                        [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
                    ]
                ),
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

        if action == "status":
            await cmd_status(msg, session, tg_id=query.from_user.id)
            await query.answer()
            return

        if action == "support":
            await state.set_state(SupportStates.chatting)
            await state.update_data(support_history=[])
            await query.answer()
            await msg.answer(support_invite_html(), parse_mode="HTML", reply_markup=support_chat_kb())
            return

        if action == "cancel_recurring":
            await query.answer()
            session = _get_session(dp)
            tg_uid = query.from_user.id
            status, data = await backend_cancel_recurring(session, tg_uid)
            text: str
            if status == 200 and data.get("ok"):
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
            reply_kb = support_chat_kb() if in_support else main_menu_kb(tg_uid)
            await msg.answer(text, reply_markup=reply_kb)
            return

        if action == "exit_support":
            await state.clear()
            await query.answer("Чат закрыт")
            tg_id = query.from_user.id
            await msg.answer(
                "Диалог закрыт. Поддержка снова — кнопка «Поддержка» или /support.",
                reply_markup=main_menu_kb(tg_id),
            )
            return

        await query.answer()

    @dp.message(Command("support"))
    async def _cmd_support(message: Message, state: FSMContext) -> None:
        await state.set_state(SupportStates.chatting)
        await state.update_data(support_history=[])
        await message.answer(support_invite_html(), parse_mode="HTML", reply_markup=support_chat_kb())

    @dp.message(Command("done"), StateFilter(SupportStates.chatting))
    async def _cmd_done(message: Message, state: FSMContext) -> None:
        await state.clear()
        tg_id = message.from_user.id if message.from_user else 0
        await message.answer(
            "Диалог закрыт. Снова нажмите «Поддержка» в меню или /support — снова напомним, что писать нужно в этот чат.",
            reply_markup=main_menu_kb(tg_id),
        )

    @dp.message(Command("reset"), StateFilter(SupportStates.chatting))
    async def _cmd_reset(message: Message, state: FSMContext) -> None:
        """Очищает контекст диалога с ИИ, не выходя из чата поддержки."""
        await state.update_data(support_history=[])
        await message.answer(
            "Контекст очищен. Опишите вопрос заново — продолжаем в этом чате.",
            reply_markup=support_chat_kb(),
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
                await message.answer(reply, reply_markup=support_chat_kb())
            else:
                await message.answer(reply, reply_markup=support_chat_kb())
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

        await message.answer(
            "Сообщение получено. Автоответ помощника сейчас недоступен — "
            "попробуйте позже или откройте «Статус» и мини-приложение в меню бота.",
            reply_markup=support_chat_kb(),
        )

    @dp.message(StateFilter(SupportStates.chatting))
    async def _support_non_text(message: Message) -> None:
        await message.answer(
            "Пока принимаем только текст — напишите вопрос прямо в этот чат сообщением.",
            reply_markup=support_chat_kb(),
        )

    @dp.callback_query(lambda c: c.data == "copy_proxy_link")
    async def _copy(query: CallbackQuery) -> None:
        session = _get_session(dp)
        msg = query.message
        if not msg or not isinstance(msg, Message):
            await query.answer("Не удалось.", show_alert=True)
            return
        proxy_link = await _get_proxy_link(session, query.from_user.id)
        if not proxy_link:
            await query.answer("Подписка не активна.", show_alert=True)
            return
        await msg.answer(f"Ссылка для копирования:\n<code>{proxy_link}</code>", parse_mode="HTML")
        await query.answer()

    @dp.callback_query(lambda c: c.data == "manual_setup")
    async def _manual(query: CallbackQuery) -> None:
        session = _get_session(dp)
        msg = query.message
        if not msg or not isinstance(msg, Message):
            await query.answer("Не удалось.", show_alert=True)
            return
        proxy_link = await _get_proxy_link(session, query.from_user.id)
        if not proxy_link:
            await query.answer("Подписка не активна.", show_alert=True)
            return
        server, port, secret = _parse_proxy_link(proxy_link)
        await msg.answer(_manual_setup_text(server, port, secret), parse_mode="HTML")
        await query.answer()

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
