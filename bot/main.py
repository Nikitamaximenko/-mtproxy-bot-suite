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
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from dotenv import load_dotenv


load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
BACKEND_BASE_URL = (os.getenv("BACKEND_BASE_URL") or "http://localhost:8000").rstrip("/")
FRONTEND_URL = (os.getenv("FRONTEND_URL") or "http://localhost:3000").strip()
SUPPORT_USERNAME = os.getenv("SUPPORT_USERNAME", "").lstrip("@").strip()
PRICE_RUB = int(os.getenv("PRICE_RUB", "500") or "500")


BUY_TEXT = f"💳 Купить подписку {PRICE_RUB}₽"
PAY_TEXT = f"💳 Оплатить {PRICE_RUB}₽"


class CheckoutFlow(StatesGroup):
    waiting_email = State()


# MVP: keep email in memory (per-process). If you restart bot frequently, user may be asked again.
_email_cache: dict[int, str] = {}


def buy_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=BUY_TEXT, url=FRONTEND_URL)]]
    )


def pay_kb(payment_url: str, token: str) -> InlineKeyboardMarkup:
    # callback_data must be <= 64 bytes; UUID fits.
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=PAY_TEXT, url=payment_url)],
            [InlineKeyboardButton(text="✅ Я оплатил", callback_data=f"chk:{token}")],
        ]
    )


def proxy_kb(proxy_link: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔌 Подключить прокси", url=proxy_link)],
            [InlineKeyboardButton(text="📋 Скопировать ссылку", callback_data="copy_proxy_link")],
        ]
    )

def support_kb() -> InlineKeyboardMarkup | None:
    if not SUPPORT_USERNAME:
        return None
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🆘 Поддержка", url=f"https://t.me/{SUPPORT_USERNAME}")]
        ]
    )


def _is_valid_email(email: str) -> bool:
    e = email.strip()
    # Good enough for MVP (avoid rejecting legitimate emails).
    return "@" in e and "." in e and " " not in e and len(e) <= 255


def _mask_email(email: str) -> str:
    e = email.strip()
    if "@" not in e:
        return e
    left, right = e.split("@", 1)
    if len(left) <= 2:
        left_mask = left[:1] + "*"
    else:
        left_mask = left[:1] + "*" * (len(left) - 2) + left[-1:]
    return f"{left_mask}@{right}"

def format_dt(dt_str: str | None) -> str:
    if not dt_str:
        return "неизвестно"
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%d.%m.%Y %H:%M")
    except Exception:
        return dt_str


async def backend_get(session: aiohttp.ClientSession, path: str) -> dict[str, Any]:
    url = f"{BACKEND_BASE_URL}{path}"
    async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
        data = await resp.json(content_type=None)
        if resp.status >= 400:
            raise RuntimeError(f"Backend error {resp.status}: {data}")
        if not isinstance(data, dict):
            raise RuntimeError("Unexpected backend response")
        return data


async def backend_post(session: aiohttp.ClientSession, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{BACKEND_BASE_URL}{path}"
    async with session.post(
        url,
        json=payload,
        timeout=aiohttp.ClientTimeout(total=15),
        headers={"Content-Type": "application/json"},
    ) as resp:
        data = await resp.json(content_type=None)
        if resp.status >= 400:
            raise RuntimeError(f"Backend error {resp.status}: {data}")
        if not isinstance(data, dict):
            raise RuntimeError("Unexpected backend response")
        return data


async def create_checkout(
    session: aiohttp.ClientSession, tg_id: int, username: str | None, email: str
) -> tuple[str, str]:
    data = await backend_post(
        session,
        "/checkout/create",
        {"telegram_id": tg_id, "username": username or None, "email": email},
    )
    payment_url = str(data.get("payment_url") or "").strip()
    payment_token = str(data.get("payment_token") or "").strip()
    if not payment_url or not payment_token:
        raise RuntimeError("Backend did not return payment_url/payment_token")
    return payment_url, payment_token


async def cmd_start(message: Message, session: aiohttp.ClientSession, state: FSMContext) -> None:
    parts = (message.text or "").split(maxsplit=1)
    token = parts[1].strip() if len(parts) > 1 else ""

    if token:
        try:
            data = await backend_get(session, f"/subscription/token/{token}")
        except Exception:
            await message.answer("Не удалось проверить оплату. Попробуйте позже.")
            return

        if not data.get("found"):
            await message.answer(
                "Оплата не найдена или ещё не подтверждена.\n\n"
                "Если вы только что оплатили — подождите 1–2 минуты и нажмите /start ещё раз.",
                reply_markup=buy_kb(),
            )
            return

        expires_at = format_dt(data.get("expires_at"))
        proxy_link = data.get("proxy_link") or ""
        if not proxy_link:
            await message.answer(
                f"✅ Подписка активна до {expires_at}\n\n"
                "Прокси ещё не готов. Попробуйте через минуту или напишите в поддержку."
            )
            return

        await message.answer(
            f"✅ Подписка активна до {expires_at}\n\nНажми кнопку ниже чтобы подключить прокси:",
            reply_markup=proxy_kb(proxy_link),
        )
        return

    tg_id = message.from_user.id if message.from_user else None
    username = message.from_user.username if message.from_user else None
    if not tg_id:
        await message.answer("Не удалось определить ваш Telegram ID.", reply_markup=support_kb())
        return

    cached = _email_cache.get(tg_id)
    if not cached:
        await state.set_state(CheckoutFlow.waiting_email)
        await message.answer(
            "Чтобы выставить оплату, пришли email одним сообщением.\n\n"
            "Он нужен lava.top для оплаты. Пример: name@example.com",
            reply_markup=support_kb(),
        )
        return

    # If email exists in cache, we create checkout immediately.
    try:
        payment_url, payment_token = await create_checkout(session, tg_id, username, cached)
    except Exception:
        await message.answer(
            "Не удалось создать оплату прямо сейчас (платёжный шлюз временно недоступен).\n\n"
            "Попробуй ещё раз через минуту.",
            reply_markup=support_kb(),
        )
        return

    await message.answer(
        "Привет!\n\n"
        "Frosty — это быстрый MTProxy для Telegram.\n\n"
        "• Работает как встроенный прокси в Telegram\n"
        "• Без VPN и ручных включений\n"
        f"• Подписка {PRICE_RUB}₽/мес\n\n"
        "Нажми «Оплатить», после оплаты вернись в бота и нажми «Я оплатил».",
        reply_markup=pay_kb(payment_url, payment_token),
    )


async def msg_email(message: Message, session: aiohttp.ClientSession, state: FSMContext) -> None:
    tg_id = message.from_user.id if message.from_user else None
    username = message.from_user.username if message.from_user else None
    if not tg_id:
        await message.answer("Не удалось определить ваш Telegram ID.", reply_markup=support_kb())
        return

    email = (message.text or "").strip()
    if not _is_valid_email(email):
        await message.answer(
            "Похоже, это не email. Пришли, пожалуйста, email в формате name@example.com",
            reply_markup=support_kb(),
        )
        return

    _email_cache[tg_id] = email.lower()
    await state.clear()

    try:
        payment_url, payment_token = await create_checkout(session, tg_id, username, email.lower())
    except Exception:
        await message.answer(
            "Не удалось создать оплату прямо сейчас (платёжный шлюз временно недоступен).\n\n"
            "Попробуй ещё раз через минуту.",
            reply_markup=support_kb(),
        )
        return

    await message.answer(
        "Отлично, email сохранён: " + _mask_email(email) + "\n\n"
        f"Подписка {PRICE_RUB}₽/мес.\n"
        "Нажми «Оплатить», после оплаты вернись в бота и нажми «Я оплатил».",
        reply_markup=pay_kb(payment_url, payment_token),
    )


async def cmd_status(message: Message, session: aiohttp.ClientSession) -> None:
    tg_id = message.from_user.id if message.from_user else None
    if not tg_id:
        await message.answer("Не удалось определить ваш Telegram ID.")
        return

    try:
        data = await backend_get(session, f"/subscription/{tg_id}")
    except Exception:
        await message.answer("Не удалось получить статус подписки. Попробуйте позже.")
        return

    if not data.get("active"):
        await message.answer("Подписка не активна.", reply_markup=buy_kb())
        return

    expires_at = format_dt(data.get("expires_at"))
    proxy_link = data.get("proxy_link")
    if proxy_link:
        await message.answer(
            f"✅ Подписка активна до {expires_at}",
            reply_markup=proxy_kb(proxy_link),
        )
    else:
        await message.answer(f"✅ Подписка активна до {expires_at}\n\nПрокси-ссылка пока недоступна.")


async def cmd_help(message: Message) -> None:
    await message.answer(
        "Как подключить прокси вручную:\n"
        "1) Открой ссылку формата tg://proxy?... (кнопка «Подключить прокси»)\n"
        "2) Telegram предложит добавить прокси — согласись\n"
        "3) Если кнопки нет — используй «Скопировать ссылку» и открой её в Telegram"
    )


async def cb_copy_proxy_link(query: CallbackQuery, session: aiohttp.ClientSession) -> None:
    msg = query.message
    if not msg or not isinstance(msg, Message):
        await query.answer("Не удалось.", show_alert=True)
        return

    tg_id = query.from_user.id
    try:
        data = await backend_get(session, f"/subscription/{tg_id}")
    except Exception:
        await query.answer("Backend недоступен.", show_alert=True)
        return

    proxy_link = data.get("proxy_link")
    if not data.get("active") or not proxy_link:
        await query.answer("Подписка не активна или ссылка недоступна.", show_alert=True)
        return

    await msg.answer(f"Ссылка для копирования:\n{proxy_link}")
    await query.answer("Ссылка отправлена сообщением.", show_alert=False)


async def cb_check_paid(query: CallbackQuery, session: aiohttp.ClientSession) -> None:
    msg = query.message
    if not msg or not isinstance(msg, Message):
        await query.answer("Не удалось.", show_alert=True)
        return

    data_str = (query.data or "").strip()
    if not data_str.startswith("chk:"):
        await query.answer("Не удалось.", show_alert=True)
        return

    token = data_str.removeprefix("chk:").strip()
    if not token:
        await query.answer("Не удалось.", show_alert=True)
        return

    try:
        data = await backend_get(session, f"/subscription/token/{token}")
    except Exception:
        await query.answer("Backend недоступен.", show_alert=True)
        return

    if not data.get("found"):
        await query.answer("Оплата ещё не подтверждена. Попробуй через 1–2 минуты.", show_alert=True)
        return

    expires_at = format_dt(data.get("expires_at"))
    proxy_link = data.get("proxy_link") or ""
    if not proxy_link:
        await query.answer("Подписка активна, но прокси ещё готовится. Попробуй чуть позже.", show_alert=True)
        return

    await msg.answer(
        f"✅ Подписка активна до {expires_at}\n\nНажми кнопку ниже чтобы подключить прокси:",
        reply_markup=proxy_kb(proxy_link),
    )
    await query.answer("Готово.", show_alert=False)


async def main() -> None:
    if not BOT_TOKEN:
        raise SystemExit("BOT_TOKEN is missing. Create bot/.env from bot/.env.example")

    logging.basicConfig(level=logging.INFO)

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())

    async def on_startup(**kwargs: Any) -> None:
        dp["http_session"] = aiohttp.ClientSession()
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

    @dp.message(CheckoutFlow.waiting_email)
    async def _email(message: Message, state: FSMContext) -> None:
        session: aiohttp.ClientSession = dp["http_session"]
        await msg_email(message, session, state)

    @dp.message(Command("status"))
    async def _status(message: Message) -> None:
        session: aiohttp.ClientSession = dp["http_session"]
        await cmd_status(message, session)

    @dp.message(Command("help"))
    async def _help(message: Message) -> None:
        await cmd_help(message)

    @dp.callback_query(lambda c: c.data == "copy_proxy_link")
    async def _copy(query: CallbackQuery) -> None:
        session: aiohttp.ClientSession = dp["http_session"]
        await cb_copy_proxy_link(query, session)

    @dp.callback_query(lambda c: (c.data or "").startswith("chk:"))
    async def _chk(query: CallbackQuery) -> None:
        session: aiohttp.ClientSession = dp["http_session"]
        await cb_check_paid(query, session)

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

