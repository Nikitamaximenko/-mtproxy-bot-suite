from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime
from typing import Any

import aiohttp
from aiogram import Bot, Dispatcher
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
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
SUPPORT_USERNAME = os.getenv("SUPPORT_USERNAME", "").lstrip("@").strip()
PRICE_RUB = int(os.getenv("PRICE_RUB", "299") or "299")
MINIAPP_PATH = (os.getenv("MINIAPP_PATH") or "/mini").strip() or "/mini"


def _miniapp_url(tg_id: int) -> str:
    base = FRONTEND_URL.rstrip("/")
    path = MINIAPP_PATH if MINIAPP_PATH.startswith("/") else f"/{MINIAPP_PATH}"
    return f"{base}{path}?tg_id={tg_id}"


def main_menu_kb(tg_id: int) -> InlineKeyboardMarkup:
    row3 = [InlineKeyboardButton(text="✅ Статус", callback_data="menu:status")]
    if SUPPORT_USERNAME:
        row3.append(InlineKeyboardButton(text="🆘 Поддержка", url=f"https://t.me/{SUPPORT_USERNAME}"))
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💳 Оформить подписку", web_app=WebAppInfo(url=_miniapp_url(tg_id)))],
        [InlineKeyboardButton(text="ℹ️ Как это работает", callback_data="menu:help")],
        row3,
    ])


def proxy_kb(proxy_link: str) -> InlineKeyboardMarkup:
    buttons: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton(text="🔌 Подключить прокси", url=proxy_link)],
        [InlineKeyboardButton(text="📋 Скопировать ссылку", callback_data="copy_proxy_link")],
        [InlineKeyboardButton(text="📖 Ручная настройка", callback_data="manual_setup")],
        [InlineKeyboardButton(text="🏠 Главное меню", callback_data="menu:main")],
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def support_kb() -> InlineKeyboardMarkup | None:
    if not SUPPORT_USERNAME:
        return None
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🆘 Поддержка", url=f"https://t.me/{SUPPORT_USERNAME}")]
        ]
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
    "<b>Как это работает</b>\n"
    "\n"
    "Frosty — это MTProxy для Telegram. "
    "Он работает прямо внутри приложения, не нужен VPN и не нужно ничего включать/выключать.\n"
    "\n"
    "<b>Быстрое подключение:</b>\n"
    "После оплаты нажми кнопку «🔌 Подключить прокси» — Telegram сам предложит добавить прокси.\n"
    "\n"
    "<b>Ручное подключение:</b>\n"
    "Если кнопка не сработала — нажми «📖 Ручная настройка» и следуй инструкции.\n"
    "\n"
    "<b>Преимущества:</b>\n"
    "• Работает 24/7 автоматически\n"
    "• Не нужен VPN — не конфликтует с другими приложениями\n"
    "• Без логов — мы не храним данные\n"
    "• Мгновенное подключение за 10 секунд"
)


async def backend_get(session: aiohttp.ClientSession, path: str) -> dict[str, Any]:
    url = f"{BACKEND_BASE_URL}{path}"
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
        data = await resp.json(content_type=None)
        if resp.status >= 400:
            raise RuntimeError(f"Backend error {resp.status}: {data}")
        if not isinstance(data, dict):
            raise RuntimeError("Unexpected backend response")
        return data


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


# ── Handlers ──


async def cmd_start(message: Message, session: aiohttp.ClientSession, state: FSMContext) -> None:
    parts = (message.text or "").split(maxsplit=1)
    token = parts[1].strip() if len(parts) > 1 else ""

    tg_id = message.from_user.id if message.from_user else None
    if not tg_id:
        await message.answer("Не удалось определить ваш Telegram ID.", reply_markup=support_kb())
        return

    await state.clear()

    if token:
        try:
            data = await backend_get(session, f"/subscription/token/{token}")
        except Exception:
            await message.answer("Не удалось проверить оплату. Попробуйте позже.")
            return

        if data.get("found"):
            expires_at = format_dt(data.get("expires_at"))
            proxy_link = data.get("proxy_link") or ""
            if proxy_link:
                await message.answer(
                    f"✅ Подписка активна до {expires_at}\n\n"
                    "Нажми «🔌 Подключить прокси» — Telegram сам предложит добавить его.",
                    reply_markup=proxy_kb(proxy_link),
                )
                return

    await message.answer(
        "Привет! Это <b>Frosty</b>.\n\n"
        "Быстрый MTProxy прямо в Telegram — без VPN и ручных настроек.\n\n"
        "Выбери действие:",
        parse_mode="HTML",
        reply_markup=main_menu_kb(tg_id),
    )


async def cmd_status(message: Message, session: aiohttp.ClientSession, tg_id: int) -> None:
    try:
        data = await backend_get(session, f"/subscription/{tg_id}")
    except Exception:
        await message.answer("Не удалось получить статус. Попробуйте позже.", reply_markup=support_kb())
        return

    if not data.get("active"):
        await message.answer(
            f"Подписка не активна.\n\nСтоимость: {PRICE_RUB} ₽/мес.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="💳 Оформить подписку", web_app=WebAppInfo(url=_miniapp_url(tg_id)))],
            ]),
        )
        return

    expires_at = format_dt(data.get("expires_at"))
    proxy_link = data.get("proxy_link")
    text = (
        f"✅ <b>Подписка активна</b>\n\n"
        f"Тариф: {PRICE_RUB} ₽/мес\n"
        f"Действует до: {expires_at}"
    )

    if proxy_link:
        await message.answer(text, parse_mode="HTML", reply_markup=proxy_kb(proxy_link))
    else:
        await message.answer(text, parse_mode="HTML")


async def main() -> None:
    if not BOT_TOKEN:
        raise SystemExit("BOT_TOKEN is missing. Create bot/.env from bot/.env.example")

    logging.basicConfig(level=logging.INFO)

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())

    async def on_startup(**kwargs: Any) -> None:
        dp["http_session"] = aiohttp.ClientSession()
        try:
            await bot.set_chat_menu_button(menu_button=MenuButtonDefault())
        except Exception:
            pass
        try:
            await bot.set_my_description(
                description=(
                    "Telegram без ограничений — за 10 секунд.\n"
                    "\n"
                    "Frosty подключает быстрый MTProxy прямо в приложение. "
                    "Без VPN, без настроек, без логов.\n"
                    "\n"
                    "• Один клик — и всё работает\n"
                    "• 24/7 без перебоев\n"
                    "• 299 ₽/мес\n"
                    "\n"
                    "Нажмите «Запустить», чтобы начать."
                )
            )
            await bot.set_my_short_description(
                short_description="Быстрый MTProxy для Telegram. Без VPN, без настроек. 299 ₽/мес."
            )
        except Exception:
            pass
        logging.getLogger(__name__).info("Bot started")

    async def on_shutdown(**kwargs: Any) -> None:
        session: aiohttp.ClientSession | None = dp.get("http_session")
        if session:
            await session.close()

    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    @dp.message(CommandStart())
    async def _start(message: Message, state: FSMContext) -> None:
        session: aiohttp.ClientSession = dp["http_session"]
        await cmd_start(message, session, state)

    @dp.message(Command("status"))
    async def _status(message: Message) -> None:
        session: aiohttp.ClientSession = dp["http_session"]
        tg_id = message.from_user.id if message.from_user else 0
        await cmd_status(message, session, tg_id)

    @dp.message(Command("help"))
    async def _help(message: Message) -> None:
        await message.answer(HELP_GENERAL, parse_mode="HTML")

    @dp.callback_query(lambda c: (c.data or "").startswith("menu:"))
    async def _menu(query: CallbackQuery, state: FSMContext) -> None:
        session: aiohttp.ClientSession = dp["http_session"]
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

        if action == "help":
            await msg.answer(HELP_GENERAL, parse_mode="HTML")
            await query.answer()
            return

        if action == "status":
            await cmd_status(msg, session, tg_id=query.from_user.id)
            await query.answer()
            return

        await query.answer()

    @dp.callback_query(lambda c: c.data == "copy_proxy_link")
    async def _copy(query: CallbackQuery) -> None:
        session: aiohttp.ClientSession = dp["http_session"]
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
        session: aiohttp.ClientSession = dp["http_session"]
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
