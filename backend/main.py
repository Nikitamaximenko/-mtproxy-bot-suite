from __future__ import annotations

import asyncio
import hmac
import html
import json
import logging
import os
import socket
import time
import urllib.error
import urllib.request
from urllib.parse import urljoin
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncGenerator, Generator, Literal
from uuid import UUID, uuid4

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Integer,
    String,
    and_,
    create_engine,
    false as sa_false,
    func,
    select,
    text,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db").strip()

# Payments (lava.top Public API)
# Docs: https://developers.lava.top/en and Swagger https://gate.lava.top/docs
PAYMENT_AMOUNT_RUB = int(os.getenv("PAYMENT_AMOUNT_RUB", "299").strip() or "299")

LAVA_TOP_API_BASE_URL = (os.getenv("LAVA_TOP_API_BASE_URL") or "https://gate.lava.top").rstrip("/")
LAVA_TOP_API_KEY = (os.getenv("LAVA_TOP_API_KEY") or "").strip()  # used to call lava.top Public API (X-Api-Key)
LAVA_TOP_OFFER_ID = (os.getenv("LAVA_TOP_OFFER_ID") or "").strip()  # offerId (uuid) to charge (your product/subscription price)

# For subscription offers in RUB, lava.top often needs these (see gate.lava.top docs /api/v3/invoice examples):
LAVA_TOP_PERIODICITY = (os.getenv("LAVA_TOP_PERIODICITY") or "").strip()  # e.g. MONTHLY
LAVA_TOP_PAYMENT_PROVIDER = (os.getenv("LAVA_TOP_PAYMENT_PROVIDER") or "").strip()  # e.g. SMART_GLOCAL, PAY2ME
LAVA_TOP_PAYMENT_METHOD = (os.getenv("LAVA_TOP_PAYMENT_METHOD") or "").strip()  # e.g. CARD, SBP

# Webhooks are authenticated by lava.top sending your service API key in X-Api-Key header
LAVA_TOP_WEBHOOK_API_KEY = (os.getenv("LAVA_TOP_WEBHOOK_API_KEY") or "").strip()

PUBLIC_BASE_URL = (os.getenv("PUBLIC_BASE_URL") or "http://localhost:8000").rstrip("/")

# MTProxy server config (single server for MVP)
MT_PROXY_SERVER = (os.getenv("MT_PROXY_SERVER") or "").strip()
MT_PROXY_PORT = int(os.getenv("MT_PROXY_PORT", "443").strip() or "443")
MT_PROXY_SECRET = (os.getenv("MT_PROXY_SECRET") or "").strip()

# Optional legacy fallback (if lava.top API is not configured or fails)
LAVA_PAY_URL_TEMPLATE = (os.getenv("LAVA_PAY_URL_TEMPLATE") or "https://lava.top/pay/YOUR_ID?order_id={payment_token}").strip()
# Full URL with {payment_token}; used if invoice API fails (highest priority fallback)
LAVA_CHECKOUT_FALLBACK_URL = (os.getenv("LAVA_CHECKOUT_FALLBACK_URL") or "").strip()

ADMIN_API_KEY = (os.getenv("ADMIN_API_KEY") or "").strip()

PRODAMUS_SECRET_KEY = (os.getenv("PRODAMUS_SECRET_KEY") or "").strip()
PRODAMUS_PAYMENT_URL = (os.getenv("PRODAMUS_PAYMENT_URL") or "https://admaster.payform.ru/").strip()

BOT_TOKEN = (os.getenv("BOT_TOKEN") or "").strip()
FRONTEND_URL = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
MINIAPP_PATH = (os.getenv("MINIAPP_PATH") or "/mini").strip() or "/mini"
ADMIN_NOTIFY_CHAT_ID = (os.getenv("ADMIN_NOTIFY_CHAT_ID") or "").strip()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mtproxy")


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ref_source: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    marketing_opt_out: Mapped[bool] = mapped_column(Boolean, default=False, server_default=sa_false(), nullable=False)
    nudge_1_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    nudge_2_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    nudge_3_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# FIX: "expired" added — it was missing from the original type
PaymentStatus = Literal["pending", "paid", "expired"]


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False)

    proxy_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    proxy_server: Mapped[str | None] = mapped_column(String(255), nullable=True)
    proxy_port: Mapped[int | None] = mapped_column(Integer, nullable=True)

    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    payment_token: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    payment_status: Mapped[str] = mapped_column(String(16), default="pending", index=True, nullable=False)
    lava_contract_id: Mapped[str | None] = mapped_column(String(36), unique=True, index=True, nullable=True)

    notified_expiring: Mapped[bool] = mapped_column(Boolean, default=False, server_default=sa_false(), nullable=False)
    notified_expired: Mapped[bool] = mapped_column(Boolean, default=False, server_default=sa_false(), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite:") else {}
engine = create_engine(DATABASE_URL, future=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, class_=Session, autocommit=False, autoflush=False, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate() -> None:
    """Add columns that create_all won't add to existing tables."""
    from sqlalchemy import inspect as sa_inspect
    inspector = sa_inspect(engine)
    tables = inspector.get_table_names()
    if "subscriptions" in tables:
        existing = {c["name"] for c in inspector.get_columns("subscriptions")}
        with engine.begin() as conn:
            if "notified_expiring" not in existing:
                conn.execute(text("ALTER TABLE subscriptions ADD COLUMN notified_expiring BOOLEAN NOT NULL DEFAULT FALSE"))
            if "notified_expired" not in existing:
                conn.execute(text("ALTER TABLE subscriptions ADD COLUMN notified_expired BOOLEAN NOT NULL DEFAULT FALSE"))
    if "users" in tables:
        existing = {c["name"] for c in inspector.get_columns("users")}
        with engine.begin() as conn:
            if "ref_source" not in existing:
                conn.execute(text("ALTER TABLE users ADD COLUMN ref_source VARCHAR(64)"))
            if "first_name" not in existing:
                conn.execute(text("ALTER TABLE users ADD COLUMN first_name VARCHAR(64)"))
            if "marketing_opt_out" not in existing:
                if engine.dialect.name == "postgresql":
                    conn.execute(
                        text("ALTER TABLE users ADD COLUMN marketing_opt_out BOOLEAN NOT NULL DEFAULT FALSE")
                    )
                else:
                    conn.execute(text("ALTER TABLE users ADD COLUMN marketing_opt_out BOOLEAN NOT NULL DEFAULT 0"))
            if "nudge_1_sent_at" not in existing:
                if engine.dialect.name == "postgresql":
                    conn.execute(
                        text("ALTER TABLE users ADD COLUMN nudge_1_sent_at TIMESTAMP WITH TIME ZONE")
                    )
                else:
                    conn.execute(text("ALTER TABLE users ADD COLUMN nudge_1_sent_at DATETIME"))
            if "nudge_2_sent_at" not in existing:
                if engine.dialect.name == "postgresql":
                    conn.execute(
                        text("ALTER TABLE users ADD COLUMN nudge_2_sent_at TIMESTAMP WITH TIME ZONE")
                    )
                else:
                    conn.execute(text("ALTER TABLE users ADD COLUMN nudge_2_sent_at DATETIME"))
            if "nudge_3_sent_at" not in existing:
                if engine.dialect.name == "postgresql":
                    conn.execute(
                        text("ALTER TABLE users ADD COLUMN nudge_3_sent_at TIMESTAMP WITH TIME ZONE")
                    )
                else:
                    conn.execute(text("ALTER TABLE users ADD COLUMN nudge_3_sent_at DATETIME"))

    # PostgreSQL: принудительно BIGINT для telegram_id (уже BIGINT — будет ошибка, игнорируем).
    if engine.dialect.name == "postgresql":
        try:
            with engine.connect() as conn:
                conn.execute(
                    text("""
                        ALTER TABLE users
                        ALTER COLUMN telegram_id TYPE BIGINT
                        USING telegram_id::bigint
                    """)
                )
                conn.execute(
                    text("""
                        ALTER TABLE subscriptions
                        ALTER COLUMN telegram_id TYPE BIGINT
                        USING telegram_id::bigint
                    """)
                )
                conn.commit()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    Base.metadata.create_all(bind=engine)
    _migrate()
    task = asyncio.create_task(_expiration_loop())
    yield
    task.cancel()


app = FastAPI(title="MTProxy Backend", version="0.3.0", lifespan=lifespan)


class HealthResponse(BaseModel):
    status: Literal["ok"]


class OkResponse(BaseModel):
    ok: bool = True


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


class TrackRefRequest(BaseModel):
    telegram_id: int = Field(..., ge=1)
    username: str | None = None
    first_name: str | None = Field(default=None, max_length=64)
    ref_source: str | None = Field(default=None, max_length=64)


@app.post("/track-ref", response_model=OkResponse)
def track_ref(payload: TrackRefRequest, db: Session = Depends(get_db)) -> OkResponse:
    user = db.execute(select(User).where(User.telegram_id == payload.telegram_id)).scalar_one_or_none()
    if user is None:
        user = User(
            telegram_id=payload.telegram_id,
            username=payload.username,
            first_name=payload.first_name,
            ref_source=payload.ref_source,
        )
        db.add(user)
        db.commit()
    else:
        changed = False
        if payload.ref_source and not user.ref_source:
            user.ref_source = payload.ref_source
            changed = True
        if payload.username:
            user.username = payload.username
            changed = True
        if payload.first_name:
            user.first_name = payload.first_name
            changed = True
        if changed:
            db.commit()
    return OkResponse(ok=True)


class MarketingOptOutRequest(BaseModel):
    telegram_id: int = Field(..., ge=1)


@app.post("/marketing/opt-out", response_model=OkResponse)
def marketing_opt_out(payload: MarketingOptOutRequest, db: Session = Depends(get_db)) -> OkResponse:
    user = db.execute(select(User).where(User.telegram_id == payload.telegram_id)).scalar_one_or_none()
    if user is not None:
        user.marketing_opt_out = True
        db.commit()
    return OkResponse(ok=True)


class CheckoutCreateRequest(BaseModel):
    telegram_id: int = Field(..., ge=1)
    username: str | None = Field(default=None, max_length=64)
    email: str | None = Field(default=None, max_length=255)

    @field_validator("telegram_id", mode="before")
    @classmethod
    def _telegram_id_from_string(cls, v: object) -> int:
        if isinstance(v, str) and v.strip().isdigit():
            return int(v)
        if isinstance(v, int):
            return v
        if isinstance(v, str):
            return int(v.strip())
        raise ValueError("telegram_id must be a positive integer")


class CheckoutCreateResponse(BaseModel):
    payment_url: str
    payment_token: UUID


def _normalize_payment_url(url: str) -> str:
    """
    Lava иногда возвращает paymentUrl без схемы или как путь (/pay/...).
    В Telegram WebApp такая ссылка открывается относительно домена мини-аппа (Vercel) → 404 Next.js.
    """
    u = (url or "").strip()
    if not u:
        return u
    if u.startswith("//"):
        return "https:" + u
    low = u.lower()
    if low.startswith("http://") or low.startswith("https://"):
        return u
    base = f"{LAVA_TOP_API_BASE_URL}/"
    return urljoin(base, u)


def _create_lava_top_invoice(email: str) -> tuple[str, str | None]:
    """
    lava.top Public API: POST /api/v3/invoice with X-Api-Key.
    Returns (paymentUrl, contractId).
    """
    if not (LAVA_TOP_API_KEY and LAVA_TOP_OFFER_ID):
        raise RuntimeError("lava.top API is not configured")

    payload: dict[str, object] = {
        "email": email,
        "offerId": LAVA_TOP_OFFER_ID,
        "currency": "RUB",
    }
    if LAVA_TOP_PERIODICITY:
        payload["periodicity"] = LAVA_TOP_PERIODICITY
    if LAVA_TOP_PAYMENT_PROVIDER:
        payload["paymentProvider"] = LAVA_TOP_PAYMENT_PROVIDER
    if LAVA_TOP_PAYMENT_METHOD:
        payload["paymentMethod"] = LAVA_TOP_PAYMENT_METHOD
    # Без этого Lava часто отклоняет инвойс для подписки RUB (paymentUrl не создаётся).
    payload.setdefault("periodicity", "MONTHLY")
    payload.setdefault("paymentProvider", "SMART_GLOCAL")
    payload.setdefault("paymentMethod", "CARD")

    req = urllib.request.Request(
        f"{LAVA_TOP_API_BASE_URL}/api/v3/invoice",
        data=json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Api-Key": LAVA_TOP_API_KEY,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:2000]
        try:
            err_json = json.loads(body)
            msg = err_json.get("error") or err_json.get("message") or body
        except json.JSONDecodeError:
            msg = body or str(e.reason)
        raise RuntimeError(f"lava HTTP {e.code}: {msg}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"lava network error: {e.reason}") from e

    data = json.loads(raw)
    if not isinstance(data, dict):
        raise RuntimeError("Unexpected lava.top response")

    payment_url = str(data.get("paymentUrl") or data.get("payment_url") or "").strip()
    contract_id = str(data.get("id") or "").strip() or None
    if not payment_url:
        raise RuntimeError(f"lava.top did not return paymentUrl, response keys: {list(data.keys())}")
    return payment_url, contract_id


def _checkout_fallback_payment_url(payment_token: str) -> str:
    """Всегда вернуть ссылку, даже если API Lava упал (чтобы пользователь не видел 502)."""
    token = payment_token
    if LAVA_CHECKOUT_FALLBACK_URL and "{payment_token}" in LAVA_CHECKOUT_FALLBACK_URL:
        return LAVA_CHECKOUT_FALLBACK_URL.format(payment_token=token)
    tmpl = LAVA_PAY_URL_TEMPLATE or ""
    if "{payment_token}" in tmpl and "YOUR_ID" not in tmpl:
        return tmpl.format(payment_token=token)
    if LAVA_TOP_OFFER_ID:
        return f"https://lava.top/pay/{LAVA_TOP_OFFER_ID}?order_id={token}"
    raise HTTPException(
        status_code=503,
        detail="Нет LAVA_TOP_OFFER_ID: укажи оффер или LAVA_CHECKOUT_FALLBACK_URL с {payment_token}",
    )


@app.post("/checkout/create", response_model=CheckoutCreateResponse)
def checkout_create(payload: CheckoutCreateRequest, db: Session = Depends(get_db)) -> CheckoutCreateResponse:
    tg_id = int(payload.telegram_id)
    username = payload.username.strip() if payload.username else None
    email = payload.email.strip().lower() if payload.email else None
    logger.info("Checkout create: tg_id=%s email=%s", tg_id, email or "(none)")

    existing_user = db.execute(select(User).where(User.telegram_id == tg_id)).scalar_one_or_none()
    is_new_user = existing_user is None
    if is_new_user:
        db.add(User(telegram_id=tg_id, username=username))
    else:
        if username and existing_user.username != username:
            existing_user.username = username

    token = uuid4()
    sub = Subscription(
        telegram_id=tg_id,
        payment_token=str(token),
        payment_status="pending",
    )
    db.add(sub)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # На редкий случай коллизии payment_token — повторим один раз.
        # FIX: После rollback пересоздаём и User (если был новым), и Subscription.
        token = uuid4()
        sub = Subscription(
            telegram_id=tg_id,
            payment_token=str(token),
            payment_status="pending",
        )
        db.add(sub)
        if is_new_user:
            still_missing = db.execute(
                select(User).where(User.telegram_id == tg_id)
            ).scalar_one_or_none()
            if still_missing is None:
                db.add(User(telegram_id=tg_id, username=username))
        db.commit()

    lava_contract_id: str | None = None
    lava_top_configured = bool(LAVA_TOP_API_KEY and LAVA_TOP_OFFER_ID)
    if email and lava_top_configured:
        try:
            payment_url, lava_contract_id = _create_lava_top_invoice(email)
        except Exception as e:
            logger.error("lava.top invoice failed tg_id=%s, using fallback URL: %s", tg_id, e)
            payment_url = _checkout_fallback_payment_url(str(token))
    else:
        try:
            payment_url = LAVA_PAY_URL_TEMPLATE.format(payment_token=str(token))
        except Exception:
            payment_url = _checkout_fallback_payment_url(str(token))
        if "YOUR_ID" in payment_url:
            payment_url = _checkout_fallback_payment_url(str(token))

    if lava_contract_id:
        sub.lava_contract_id = lava_contract_id
        db.commit()

    payment_url = _normalize_payment_url(payment_url)
    return CheckoutCreateResponse(payment_url=payment_url, payment_token=token)


def activate_subscription(sub: Subscription) -> None:
    # FIX: Removed hardcoded fallback credentials. Missing config now raises immediately
    # instead of silently using secrets embedded in source code.
    if not MT_PROXY_SERVER:
        raise RuntimeError("MT_PROXY_SERVER is not configured")
    if not MT_PROXY_SECRET:
        raise RuntimeError("MT_PROXY_SECRET is not configured")
    sub.payment_status = "paid"
    sub.expires_at = utcnow() + timedelta(days=30)
    sub.proxy_server = MT_PROXY_SERVER
    sub.proxy_port = MT_PROXY_PORT
    sub.proxy_secret = MT_PROXY_SECRET


def _miniapp_public_url(tg_id: int) -> str:
    """Публичный URL мини-аппа (как в боте), для кнопки web_app в рассылках."""
    if not FRONTEND_URL:
        return ""
    path = MINIAPP_PATH if MINIAPP_PATH.startswith("/") else f"/{MINIAPP_PATH}"
    v = int(time.time())
    return f"{FRONTEND_URL}{path}?tg_id={tg_id}&v={v}"


def _sales_subscribe_keyboard(tg_id: int) -> dict[str, Any] | None:
    url = _miniapp_public_url(tg_id)
    if not url:
        return None
    return {
        "inline_keyboard": [
            [{"text": "💳 Оформить подписку", "web_app": {"url": url}}],
        ]
    }


def _sales_greeting(user: User) -> str:
    # FIX: html.escape user-provided strings to prevent HTML injection in messages
    if user.first_name:
        return html.escape(user.first_name)
    if user.username:
        return html.escape(f"@{user.username}")
    return "Привет"


def _sales_nudge_message(step: int, user: User) -> str:
    g = _sales_greeting(user)
    price = PAYMENT_AMOUNT_RUB
    ref_line = ""
    if user.ref_source:
        # FIX: html.escape ref_source — it is user-supplied input
        ref_line = f"\n\nТы заходил по ссылке с меткой <code>{html.escape(user.ref_source)}</code>."
    if step == 1:
        return (
            f"{g}, коротко напомню: бесплатные прокси часто перегружены и непредсказуемы, "
            f"а <b>Frosty</b> — доступ без очереди «на всех».\n\n"
            "Проверь сторис и видео после подключения — обычно разница заметна сразу.\n\n"
            f"Оформление — <b>{price} ₽/мес</b>, подключение в пару касаний.{ref_line}\n\n"
            "<i>Не хотите рассылку — команда /stop</i>"
        )
    if step == 2:
        return (
            f"{g}, <b>Frosty</b> держит MTProxy для Telegram 24/7 — без VPN на весь интернет "
            "и без пляски с публичными списками.\n\n"
            "Если есть вопрос — нажми «Поддержка» в главном меню бота.\n\n"
            f"<b>{price} ₽/мес</b>, подключение за ~10 секунд.{ref_line}\n\n"
            "<i>Отписаться от напоминаний: /stop</i>"
        )
    return (
        f"{g}, последнее напоминание: если Telegram всё ещё тормозит без прокси, "
        "попробуй Frosty — многие подключают один раз и не возвращаются к бесплатным прокси.\n\n"
        f"<b>{price} ₽/мес</b>. Ниже кнопка оформления.{ref_line}\n\n"
        "<i>/stop — больше не пришлём такие сообщения</i>"
    )


def _process_sales_nudges() -> None:
    """Отложенные напоминания неплатящим (раз в час вместе с expiration loop)."""
    if not BOT_TOKEN or not FRONTEND_URL:
        return
    db = SessionLocal()
    try:
        now = utcnow()
        paid_rows = db.execute(
            select(Subscription.telegram_id)
            .where(Subscription.payment_status.in_(["paid", "expired"]))
            .distinct()
        ).scalars().all()
        paid_set = set(paid_rows)

        users = db.execute(
            select(User).where(User.marketing_opt_out == False)  # noqa: E712
        ).scalars().all()

        for user in users:
            if user.telegram_id in paid_set:
                continue
            tg = int(user.telegram_id)
            mini_kb = _sales_subscribe_keyboard(tg)
            if user.nudge_1_sent_at is None and user.created_at + timedelta(hours=2) <= now:
                if _send_tg(tg, _sales_nudge_message(1, user), mini_kb):
                    user.nudge_1_sent_at = now
                    logger.info("Sales nudge 1 sent tg_id=%s", tg)
            elif user.nudge_2_sent_at is None and user.created_at + timedelta(hours=24) <= now:
                if _send_tg(tg, _sales_nudge_message(2, user), mini_kb):
                    user.nudge_2_sent_at = now
                    logger.info("Sales nudge 2 sent tg_id=%s", tg)
            elif user.nudge_3_sent_at is None and user.created_at + timedelta(hours=72) <= now:
                if _send_tg(tg, _sales_nudge_message(3, user), mini_kb):
                    user.nudge_3_sent_at = now
                    logger.info("Sales nudge 3 sent tg_id=%s", tg)

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _send_tg(tg_id: int, text: str, keyboard: dict | None = None) -> bool:
    """Send message via Telegram Bot API. Returns True if request completed without error."""
    if not BOT_TOKEN:
        logger.error("_send_tg: BOT_TOKEN is empty!")
        return False
    logger.info("_send_tg: BOT_TOKEN present, len=%s", len(BOT_TOKEN))
    try:
        body: dict[str, object] = {"chat_id": tg_id, "text": text, "parse_mode": "HTML"}
        if keyboard:
            body["reply_markup"] = keyboard
        body_str = json.dumps(body)
        data = body_str.encode()
        # Token redacted in log — never expose it in plaintext
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        url_safe = f"https://api.telegram.org/bot***{BOT_TOKEN[-4:]}/sendMessage"
        logger.info("_send_tg request: tg_id=%s url=%s body=%s", tg_id, url_safe, body_str[:200])
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10)
        return True
    except urllib.error.HTTPError as exc:
        # 403 = bot blocked by user, 400 = chat not found — expected, skip
        if exc.code in (400, 403):
            logger.info("_send_tg skipped tg_id=%s: HTTP %s (bot blocked or chat not found)", tg_id, exc.code)
        else:
            try:
                resp_body = exc.read().decode("utf-8", errors="replace")
            except Exception:
                resp_body = "<unreadable>"
            logger.warning("_send_tg failed tg_id=%s: HTTP %s %s — %s", tg_id, exc.code, exc.reason, resp_body)
        return False
    except Exception as exc:
        logger.warning("_send_tg failed tg_id=%s: %s", tg_id, exc)
        return False


def _notify_payment_success(tg_id: int, proxy_link: str) -> None:
    kb = {"inline_keyboard": [
        [{"text": "🔌 Подключить прокси", "url": proxy_link}],
        [{"text": "📋 Скопировать ссылку", "callback_data": "copy_proxy_link"}],
        [{"text": "📖 Ручная настройка", "callback_data": "manual_setup"}],
    ]}
    _send_tg(tg_id, (
        "✅ Оплата прошла!\n\n"
        "Ваша подписка активна 30 дней.\n"
        "Нажмите кнопку ниже, чтобы подключить прокси."
    ), kb)


def _notify_admin_payment(tg_id: int) -> None:
    """Notify admin in Telegram when a payment succeeds."""
    if not ADMIN_NOTIFY_CHAT_ID or not BOT_TOKEN:
        return
    try:
        chat_id = int(ADMIN_NOTIFY_CHAT_ID)
    except ValueError:
        return
    _send_tg(chat_id, f"💰 Оплата получена от пользователя <code>{tg_id}</code>")


def _notify_expiring(tg_id: int, expires_at: datetime) -> None:
    date_str = expires_at.strftime("%d.%m.%Y")
    buttons: list[list[dict[str, str]]] = [
        [{"text": "💳 Продлить подписку", "callback_data": "menu:subscribe"}],
    ]
    _send_tg(tg_id, (
        f"⏳ Подписка заканчивается <b>{date_str}</b>\n\n"
        "Продлите, чтобы прокси продолжал работать."
    ), {"inline_keyboard": buttons})


def _notify_expired(tg_id: int) -> None:
    buttons: list[list[dict[str, str]]] = [
        [{"text": "💳 Оформить подписку", "callback_data": "menu:subscribe"}],
    ]
    _send_tg(tg_id, (
        "❌ Подписка истекла\n\n"
        "Прокси больше не работает.\n"
        "Оформите подписку заново — подключение займёт 10 секунд."
    ), {"inline_keyboard": buttons})


def _process_expiration_notifications() -> None:
    db = SessionLocal()
    try:
        now = utcnow()
        three_days_ahead = now + timedelta(days=3)

        expiring = db.execute(
            select(Subscription).where(
                Subscription.payment_status == "paid",
                Subscription.expires_at.is_not(None),
                Subscription.expires_at <= three_days_ahead,
                Subscription.expires_at > now,
                Subscription.notified_expiring == False,  # noqa: E712
            )
        ).scalars().all()

        for sub in expiring:
            logger.info("Sending expiring notification to tg_id=%s (expires %s)", sub.telegram_id, sub.expires_at)
            _notify_expiring(sub.telegram_id, sub.expires_at)  # type: ignore[arg-type]
            sub.notified_expiring = True

        expired = db.execute(
            select(Subscription).where(
                Subscription.payment_status == "paid",
                Subscription.expires_at.is_not(None),
                Subscription.expires_at <= now,
                Subscription.notified_expired == False,  # noqa: E712
            )
        ).scalars().all()

        for sub in expired:
            logger.info("Sending expired notification to tg_id=%s", sub.telegram_id)
            _notify_expired(sub.telegram_id)
            sub.notified_expired = True

        db.commit()
        if expiring or expired:
            logger.info("Expiration check: %d expiring, %d expired notifications sent", len(expiring), len(expired))
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def _expiration_loop() -> None:
    """Background loop: expiring subscriptions + sales nudges (hourly).

    FIX: Sync functions (_process_*) perform DB queries and urllib HTTP calls.
    Running them directly in an async function would block the event loop.
    Using run_in_executor offloads them to a thread pool instead.
    """
    await asyncio.sleep(10)  # let the app start
    loop = asyncio.get_event_loop()
    while True:
        try:
            await loop.run_in_executor(None, _process_expiration_notifications)
        except Exception:
            logger.exception("Expiration check failed")
        try:
            await loop.run_in_executor(None, _process_sales_nudges)
        except Exception:
            logger.exception("Sales nudges failed")
        await asyncio.sleep(3600)


@app.post("/webhooks/lava", response_model=OkResponse)
async def lava_webhook(req: Request, db: Session = Depends(get_db)) -> OkResponse:
    raw_body = await req.body()
    logger.info("Webhook received: headers=%s body=%s", dict(req.headers), raw_body[:500])

    # FIX: If the webhook key is not configured, log a warning but do not process
    # the event — accepting unauthenticated webhooks would allow anyone to activate
    # subscriptions without payment.
    if not LAVA_TOP_WEBHOOK_API_KEY:
        logger.warning("LAVA_TOP_WEBHOOK_API_KEY is not set — rejecting webhook to prevent unauthorised activation")
        raise HTTPException(status_code=401, detail="Webhook authentication not configured")

    got = (req.headers.get("x-api-key") or "").strip()
    # FIX: Use hmac.compare_digest to prevent timing attacks.
    # FIX: Return 401 on mismatch (not 200) so the caller knows the request was rejected.
    # FIX: Do not log any portion of the secret key.
    if not hmac.compare_digest(got, LAVA_TOP_WEBHOOK_API_KEY):
        logger.warning("Webhook rejected: invalid X-Api-Key")
        raise HTTPException(status_code=401, detail="Unauthorized")

    payload = json.loads(raw_body) if raw_body else {}
    if not isinstance(payload, dict):
        return OkResponse(ok=True)

    event_type = str(payload.get("eventType") or "").strip()
    product = payload.get("product") or {}
    buyer = payload.get("buyer") or {}
    contract_id = (
        str(payload.get("contractId") or product.get("contractId") or buyer.get("contractId") or "").strip()
    )
    parent_contract_id = (
        str(payload.get("parentContractId") or product.get("parentContractId") or buyer.get("parentContractId") or "").strip()
    )
    logger.info("Webhook eventType=%s contractId=%s parentContractId=%s", event_type, contract_id or None, parent_contract_id or None)

    if event_type not in {"payment.success", "subscription.recurring.payment.success"}:
        return OkResponse(ok=True)

    # payment.success: use contractId (first payment)
    # subscription.recurring.payment.success: use parentContractId (we saved the first contract)
    lookup_id = contract_id if event_type == "payment.success" else (parent_contract_id or contract_id)
    if not lookup_id:
        return OkResponse(ok=True)

    sub = db.execute(select(Subscription).where(Subscription.lava_contract_id == lookup_id)).scalar_one_or_none()
    if sub is None:
        logger.warning("No subscription found for contractId=%s (event=%s)", lookup_id, event_type)
        return OkResponse(ok=True)

    try:
        activate_subscription(sub)
    except RuntimeError as e:
        logger.error("activate_subscription failed for contractId=%s: %s", lookup_id, e)
        raise HTTPException(status_code=503, detail=str(e))

    db.commit()
    logger.info("Subscription activated for tg_id=%s contract=%s", sub.telegram_id, contract_id)

    proxy_link = f"tg://proxy?server={sub.proxy_server}&port={sub.proxy_port}&secret={sub.proxy_secret}"
    _notify_payment_success(sub.telegram_id, proxy_link)
    _notify_admin_payment(sub.telegram_id)

    return OkResponse(ok=True)


@app.post("/webhooks/prodamus", response_model=OkResponse)
async def prodamus_webhook(req: Request, db: Session = Depends(get_db)) -> OkResponse:
    raw_body = await req.body()
    logger.info("Prodamus webhook received: body=%s", raw_body[:500])

    if not PRODAMUS_SECRET_KEY:
        logger.warning("PRODAMUS_SECRET_KEY not set — rejecting webhook")
        raise HTTPException(status_code=401, detail="Webhook authentication not configured")

    got_sign = (req.headers.get("sign") or "").strip()
    import hashlib as _hashlib  # already imported at top via hmac dependency
    expected = hmac.new(PRODAMUS_SECRET_KEY.encode(), raw_body, _hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, got_sign):
        logger.warning("Prodamus webhook rejected: invalid sign")
        raise HTTPException(status_code=401, detail="Unauthorized")

    from urllib.parse import parse_qs
    fields = parse_qs(raw_body.decode("utf-8", errors="replace"))
    order_id = (fields.get("order_id") or [""])[0].strip()
    status = (fields.get("status") or [""])[0].strip()
    logger.info("Prodamus webhook order_id=%s status=%s", order_id or None, status)

    if status != "paid" or not order_id:
        return OkResponse(ok=True)

    sub = db.execute(select(Subscription).where(Subscription.payment_token == order_id)).scalar_one_or_none()
    if sub is None:
        logger.warning("Prodamus: no subscription for order_id=%s", order_id)
        return OkResponse(ok=True)

    try:
        activate_subscription(sub)
    except RuntimeError as e:
        logger.error("Prodamus activate_subscription failed order_id=%s: %s", order_id, e)
        raise HTTPException(status_code=503, detail=str(e))

    db.commit()
    logger.info("Prodamus subscription activated tg_id=%s order_id=%s", sub.telegram_id, order_id)

    proxy_link = f"tg://proxy?server={sub.proxy_server}&port={sub.proxy_port}&secret={sub.proxy_secret}"
    _notify_payment_success(sub.telegram_id, proxy_link)
    _notify_admin_payment(sub.telegram_id)

    return OkResponse(ok=True)


class ProdamusCheckoutRequest(BaseModel):
    telegram_id: int = Field(..., ge=1)
    username: str | None = Field(default=None, max_length=64)

    @field_validator("telegram_id", mode="before")
    @classmethod
    def _tg_id_from_str(cls, v: object) -> int:
        if isinstance(v, str):
            return int(v.strip())
        if isinstance(v, int):
            return v
        raise ValueError("telegram_id must be a positive integer")


class ProdamusCheckoutResponse(BaseModel):
    payment_url: str
    payment_token: UUID


@app.post("/checkout/create-prodamus", response_model=ProdamusCheckoutResponse)
def checkout_create_prodamus(payload: ProdamusCheckoutRequest, db: Session = Depends(get_db)) -> ProdamusCheckoutResponse:
    tg_id = int(payload.telegram_id)
    username = payload.username.strip() if payload.username else None
    logger.info("Prodamus checkout create: tg_id=%s", tg_id)

    existing_user = db.execute(select(User).where(User.telegram_id == tg_id)).scalar_one_or_none()
    is_new_user = existing_user is None
    if is_new_user:
        db.add(User(telegram_id=tg_id, username=username))
    else:
        if username and existing_user.username != username:
            existing_user.username = username

    token = uuid4()
    sub = Subscription(
        telegram_id=tg_id,
        payment_token=str(token),
        payment_status="pending",
    )
    db.add(sub)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        token = uuid4()
        sub = Subscription(
            telegram_id=tg_id,
            payment_token=str(token),
            payment_status="pending",
        )
        db.add(sub)
        if is_new_user:
            still_missing = db.execute(select(User).where(User.telegram_id == tg_id)).scalar_one_or_none()
            if still_missing is None:
                db.add(User(telegram_id=tg_id, username=username))
        db.commit()

    base = PRODAMUS_PAYMENT_URL.rstrip("/") + "/"
    payment_url = (
        f"{base}?order_id={token}"
        f"&do=link"
        f"&products[0][name]=Frosty+MTProxy"
        f"&products[0][price]=299"
        f"&products[0][quantity]=1"
    )
    logger.info("Prodamus payment_url created for tg_id=%s token=%s", tg_id, token)
    return ProdamusCheckoutResponse(payment_url=payment_url, payment_token=token)


class SubscriptionResponse(BaseModel):
    active: bool
    expires_at: datetime | None = None
    proxy_link: str | None = None


@app.get("/subscription/{telegram_id}", response_model=SubscriptionResponse)
def get_subscription(telegram_id: int, db: Session = Depends(get_db)) -> SubscriptionResponse:
    now = utcnow()
    sub = (
        db.execute(
            select(Subscription)
            .where(
                Subscription.telegram_id == int(telegram_id),
                Subscription.payment_status == "paid",
                Subscription.expires_at.is_not(None),
                Subscription.expires_at > now,
            )
            .order_by(Subscription.expires_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )

    if not sub:
        return SubscriptionResponse(active=False, expires_at=None, proxy_link=None)

    if not (sub.proxy_server and sub.proxy_port and sub.proxy_secret):
        return SubscriptionResponse(active=True, expires_at=sub.expires_at, proxy_link=None)

    proxy_link = f"tg://proxy?server={sub.proxy_server}&port={sub.proxy_port}&secret={sub.proxy_secret}"
    return SubscriptionResponse(active=True, expires_at=sub.expires_at, proxy_link=proxy_link)


class CheckTokenResponse(BaseModel):
    found: bool
    expires_at: datetime | None = None
    proxy_link: str | None = None


@app.get("/subscription/token/{token}", response_model=CheckTokenResponse)
def check_token(token: UUID, db: Session = Depends(get_db)) -> CheckTokenResponse:
    sub = db.execute(select(Subscription).where(Subscription.payment_token == str(token))).scalar_one_or_none()
    if sub is None or sub.payment_status != "paid":
        return CheckTokenResponse(found=False)

    proxy_link: str | None = None
    if sub.proxy_server and sub.proxy_port and sub.proxy_secret:
        proxy_link = f"tg://proxy?server={sub.proxy_server}&port={sub.proxy_port}&secret={sub.proxy_secret}"

    return CheckTokenResponse(found=True, expires_at=sub.expires_at, proxy_link=proxy_link)


def _require_admin(req: Request) -> None:
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Admin API not configured")
    got = (req.headers.get("x-admin-key") or "").strip()
    # FIX: Use hmac.compare_digest to prevent timing-based key enumeration
    if not hmac.compare_digest(got, ADMIN_API_KEY):
        raise HTTPException(status_code=403, detail="Forbidden")


class LavaTestRequest(BaseModel):
    payment_token: UUID


@app.post("/webhooks/lava/test", response_model=OkResponse)
def lava_test(payload: LavaTestRequest, req: Request, db: Session = Depends(get_db)) -> OkResponse:
    _require_admin(req)
    sub = db.execute(select(Subscription).where(Subscription.payment_token == str(payload.payment_token))).scalar_one_or_none()
    if sub is None:
        raise HTTPException(status_code=404, detail="Subscription not found for payment_token")

    try:
        activate_subscription(sub)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    db.commit()

    proxy_link = f"tg://proxy?server={sub.proxy_server}&port={sub.proxy_port}&secret={sub.proxy_secret}"
    _notify_payment_success(sub.telegram_id, proxy_link)

    return OkResponse(ok=True)


@app.post("/admin/check-expirations", response_model=OkResponse)
def admin_check_expirations(req: Request) -> OkResponse:
    _require_admin(req)
    _process_expiration_notifications()
    return OkResponse(ok=True)


class BroadcastRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4096)
    # По умолчанию не трогаем тех, кто отписался от маркетинга (как nudge-рассылки).
    include_opted_out: bool = False
    button_text: str | None = Field(None, max_length=64)
    button_url: str | None = Field(None, max_length=2048)


class BroadcastResponse(BaseModel):
    ok: bool
    total: int
    sent: int
    failed: int


@app.post("/admin/broadcast", response_model=BroadcastResponse)
def admin_broadcast(payload: BroadcastRequest, req: Request, db: Session = Depends(get_db)) -> BroadcastResponse:
    """
    Рассылка HTML-текста всем пользователям из таблицы users (по telegram_id).
    Заголовок: x-admin-key. Лимит Telegram на сообщение — 4096 символов.
    По умолчанию исключаются пользователи с marketing_opt_out (см. include_opted_out).
    """
    _require_admin(req)
    if not BOT_TOKEN:
        raise HTTPException(status_code=503, detail="BOT_TOKEN is not configured on backend")

    total_count = db.execute(select(func.count()).select_from(User)).scalar() or 0
    opted_out_count = (
        db.execute(select(func.count()).select_from(User).where(User.marketing_opt_out == True)).scalar() or 0  # noqa: E712
    )
    logger.info("All users count=%s, opted_out_excluded=%s", total_count, opted_out_count)

    q = select(User.telegram_id)
    if not payload.include_opted_out:
        q = q.where(User.marketing_opt_out == False)  # noqa: E712
    rows = db.execute(q).scalars().all()
    # Уникальные id, стабильный порядок
    seen: set[int] = set()
    ids: list[int] = []
    for raw in rows:
        uid = int(raw)
        if uid not in seen:
            seen.add(uid)
            ids.append(uid)

    logger.info("Broadcast ids (first 10): %s", ids[:10])

    msg = payload.message.strip()
    kb: dict | None = None
    if payload.button_text and payload.button_url:
        kb = {"inline_keyboard": [[{"text": payload.button_text, "url": payload.button_url}]]}

    logger.info(
        "Broadcast started: total_recipients=%s include_opted_out=%s has_button=%s",
        len(ids), payload.include_opted_out, kb is not None,
    )

    sent = 0
    failed = 0
    for uid in ids:
        ok = _send_tg(uid, msg, kb)
        if ok:
            sent += 1
            logger.info("Broadcast sent tg_id=%s (%s/%s)", uid, sent + failed, len(ids))
        else:
            failed += 1
            logger.info("Broadcast failed tg_id=%s (%s/%s)", uid, sent + failed, len(ids))
        time.sleep(0.05)  # ~20 msg/s, мягче к лимитам Telegram

    logger.info("Broadcast finished total=%s sent=%s failed=%s", len(ids), sent, failed)
    return BroadcastResponse(ok=True, total=len(ids), sent=sent, failed=failed)


@app.post("/admin/deactivate/{telegram_id}", response_model=OkResponse)
def admin_deactivate(telegram_id: int, req: Request, db: Session = Depends(get_db)) -> OkResponse:
    _require_admin(req)
    subs = db.execute(
        select(Subscription).where(
            Subscription.telegram_id == telegram_id,
            Subscription.payment_status == "paid",
        )
    ).scalars().all()
    now = utcnow()
    for sub in subs:
        sub.payment_status = "expired"
        sub.expires_at = now
        sub.proxy_server = None
        sub.proxy_port = None
        sub.proxy_secret = None
    db.commit()
    logger.info("Admin deactivated subscriptions for tg_id=%s (%d row(s))", telegram_id, len(subs))
    return OkResponse(ok=True)


class AdminUserDebugResponse(BaseModel):
    telegram_id: int
    user_exists: bool
    username: str | None
    subscriptions: list[dict]


@app.get("/admin/user/{telegram_id}", response_model=AdminUserDebugResponse)
def admin_user_debug(telegram_id: int, req: Request, db: Session = Depends(get_db)) -> AdminUserDebugResponse:
    """Debug: check if user exists and their subscriptions."""
    _require_admin(req)
    user = db.execute(select(User).where(User.telegram_id == telegram_id)).scalar_one_or_none()
    subs = db.execute(
        select(Subscription).where(Subscription.telegram_id == telegram_id).order_by(Subscription.created_at.desc())
    ).scalars().all()
    return AdminUserDebugResponse(
        telegram_id=telegram_id,
        user_exists=user is not None,
        username=user.username if user else None,
        subscriptions=[
            {
                "id": s.id,
                "payment_status": s.payment_status,
                "expires_at": s.expires_at.isoformat() if s.expires_at else None,
                "lava_contract_id": s.lava_contract_id,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in subs
        ],
    )


@app.post("/admin/activate/{telegram_id}", response_model=OkResponse)
def admin_activate(telegram_id: int, req: Request, db: Session = Depends(get_db)) -> OkResponse:
    """
    Admin helper: force-activate subscription for MVP testing.
    Extends an existing subscription (latest by created_at) by 30 days,
    or creates a new paid subscription record if none exists.
    """
    _require_admin(req)

    sub = (
        db.execute(
            select(Subscription)
            .where(Subscription.telegram_id == telegram_id)
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )

    if sub is None:
        token = uuid4()
        sub = Subscription(
            telegram_id=telegram_id,
            payment_token=str(token),
            payment_status="paid",
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

    try:
        activate_subscription(sub)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    db.commit()
    return OkResponse(ok=True)


# ── Admin Dashboard API ──


class RefStat(BaseModel):
    source: str
    count: int


class AdminStatsResponse(BaseModel):
    total_users: int
    marketing_opt_out_users: int
    active_subscriptions: int
    expired_subscriptions: int
    pending_payments: int
    revenue_estimate: int
    referrals: list[RefStat]


@app.get("/admin/stats", response_model=AdminStatsResponse)
def admin_stats(req: Request, db: Session = Depends(get_db)) -> AdminStatsResponse:
    _require_admin(req)
    now = utcnow()

    total_users = db.execute(select(func.count()).select_from(User)).scalar() or 0
    marketing_opt_out_users = (
        db.execute(
            select(func.count()).select_from(User).where(User.marketing_opt_out == True),  # noqa: E712
        ).scalar()
        or 0
    )

    active = db.execute(
        select(func.count()).select_from(Subscription).where(
            Subscription.payment_status == "paid",
            Subscription.expires_at.is_not(None),
            Subscription.expires_at > now,
        )
    ).scalar() or 0

    expired = db.execute(
        select(func.count()).select_from(Subscription).where(
            Subscription.payment_status.in_(["paid", "expired"]),
            Subscription.expires_at.is_not(None),
            Subscription.expires_at <= now,
        )
    ).scalar() or 0

    pending = db.execute(
        select(func.count()).select_from(Subscription).where(
            Subscription.payment_status == "pending",
        )
    ).scalar() or 0

    total_paid = db.execute(
        select(func.count()).select_from(Subscription).where(
            Subscription.payment_status.in_(["paid", "expired"]),
        )
    ).scalar() or 0

    ref_rows = db.execute(
        select(User.ref_source, func.count().label("cnt"))
        .where(User.ref_source.is_not(None))
        .group_by(User.ref_source)
        .order_by(func.count().desc())
    ).all()
    referrals = [RefStat(source=r[0], count=r[1]) for r in ref_rows]

    return AdminStatsResponse(
        total_users=total_users,
        marketing_opt_out_users=marketing_opt_out_users,
        active_subscriptions=active,
        expired_subscriptions=expired,
        pending_payments=pending,
        revenue_estimate=total_paid * PAYMENT_AMOUNT_RUB,
        referrals=referrals,
    )


class SubInfo(BaseModel):
    id: int
    telegram_id: int
    username: str | None = None
    payment_status: str
    expires_at: datetime | None
    created_at: datetime
    has_proxy: bool


class AdminSubsResponse(BaseModel):
    subscriptions: list[SubInfo]
    total: int


@app.get("/admin/subscriptions", response_model=AdminSubsResponse)
def admin_subscriptions(
    req: Request,
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> AdminSubsResponse:
    # FIX: Added pagination (limit/offset) and return real total count instead of
    # silently truncating results with a hardcoded limit of 100.
    _require_admin(req)
    total = db.execute(select(func.count()).select_from(Subscription)).scalar() or 0
    subs = db.execute(
        select(Subscription).order_by(Subscription.created_at.desc()).limit(limit).offset(offset)
    ).scalars().all()

    items = [
        SubInfo(
            id=s.id,
            telegram_id=s.telegram_id,
            username=None,
            payment_status=s.payment_status,
            expires_at=s.expires_at,
            created_at=s.created_at,
            has_proxy=bool(s.proxy_server and s.proxy_port and s.proxy_secret),
        )
        for s in subs
    ]
    return AdminSubsResponse(subscriptions=items, total=total)


def _latest_subquery_for_telegram_ids(telegram_id_filter):
    """Subquery: (tg_id, max_created) for latest Subscription row per user, optional filter by telegram ids."""
    stmt = select(
        Subscription.telegram_id.label("tg_id"),
        func.max(Subscription.created_at).label("max_created"),
    ).group_by(Subscription.telegram_id)
    if telegram_id_filter is not None:
        stmt = stmt.where(Subscription.telegram_id.in_(telegram_id_filter))
    return stmt.subquery()


@app.get("/admin/users", response_model=AdminSubsResponse)
def admin_users(req: Request, db: Session = Depends(get_db)) -> AdminSubsResponse:
    """Unique users with their latest subscription status (one row per telegram_id)."""
    _require_admin(req)
    latest_subq = _latest_subquery_for_telegram_ids(None)

    rows = db.execute(
        select(Subscription, User.username)
        .join(
            latest_subq,
            and_(
                Subscription.telegram_id == latest_subq.c.tg_id,
                Subscription.created_at == latest_subq.c.max_created,
            ),
        )
        .outerjoin(User, User.telegram_id == Subscription.telegram_id)
        .order_by(Subscription.created_at.desc())
        .limit(5000)
    ).all()

    items = [
        SubInfo(
            id=s.id,
            telegram_id=s.telegram_id,
            username=uname,
            payment_status=s.payment_status,
            expires_at=s.expires_at,
            created_at=s.created_at,
            has_proxy=bool(s.proxy_server and s.proxy_port and s.proxy_secret),
        )
        for s, uname in rows
    ]
    return AdminSubsResponse(subscriptions=items, total=len(items))


class RegistryUserInfo(BaseModel):
    id: int
    telegram_id: int
    username: str | None
    ref_source: str | None
    created_at: datetime


class AdminUsersOverviewResponse(BaseModel):
    """Все записи из users без оплаченной/истёкшей подписки vs платящие клиенты."""

    new_users: list[RegistryUserInfo]
    subscribers: list[SubInfo]
    new_users_total: int
    subscribers_total: int
    users_table_total: int


@app.get("/admin/users-overview", response_model=AdminUsersOverviewResponse)
def admin_users_overview(
    req: Request,
    db: Session = Depends(get_db),
    limit: int = Query(5000, ge=1, le=20000),
) -> AdminUsersOverviewResponse:
    _require_admin(req)

    users_table_total = db.execute(select(func.count()).select_from(User)).scalar() or 0

    paid_telegram_ids = (
        select(Subscription.telegram_id)
        .where(Subscription.payment_status.in_(["paid", "expired"]))
        .distinct()
    )

    new_users_list = (
        db.execute(
            select(User)
            .where(User.telegram_id.notin_(paid_telegram_ids))
            .order_by(User.created_at.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )

    new_users_total = (
        db.execute(
            select(func.count()).select_from(User).where(User.telegram_id.notin_(paid_telegram_ids))
        ).scalar()
        or 0
    )

    paid_ids_subq = paid_telegram_ids.subquery()
    latest_subq = _latest_subquery_for_telegram_ids(select(paid_ids_subq.c.telegram_id))

    sub_rows = db.execute(
        select(Subscription, User.username)
        .join(
            latest_subq,
            and_(
                Subscription.telegram_id == latest_subq.c.tg_id,
                Subscription.created_at == latest_subq.c.max_created,
            ),
        )
        .outerjoin(User, User.telegram_id == Subscription.telegram_id)
        .order_by(Subscription.created_at.desc())
        .limit(limit)
    ).all()

    subscribers = [
        SubInfo(
            id=s.id,
            telegram_id=s.telegram_id,
            username=uname,
            payment_status=s.payment_status,
            expires_at=s.expires_at,
            created_at=s.created_at,
            has_proxy=bool(s.proxy_server and s.proxy_port and s.proxy_secret),
        )
        for s, uname in sub_rows
    ]

    subscribers_total = db.execute(select(func.count()).select_from(paid_ids_subq)).scalar() or 0

    return AdminUsersOverviewResponse(
        new_users=[
            RegistryUserInfo(
                id=u.id,
                telegram_id=int(u.telegram_id),
                username=u.username,
                ref_source=u.ref_source,
                created_at=u.created_at,
            )
            for u in new_users_list
        ],
        subscribers=subscribers,
        new_users_total=int(new_users_total),
        subscribers_total=int(subscribers_total),
        users_table_total=int(users_table_total),
    )


class ProxyStatusResponse(BaseModel):
    server: str
    port: int
    online: bool
    latency_ms: float | None


@app.get("/admin/proxy-status", response_model=ProxyStatusResponse)
def admin_proxy_status(req: Request) -> ProxyStatusResponse:
    _require_admin(req)
    server = MT_PROXY_SERVER or ""
    if not server:
        raise HTTPException(status_code=503, detail="MT_PROXY_SERVER is not configured")
    port = MT_PROXY_PORT

    online = False
    latency_ms: float | None = None
    try:
        start = time.monotonic()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect((server, port))
        latency_ms = round((time.monotonic() - start) * 1000, 1)
        sock.close()
        online = True
    except Exception:
        pass

    return ProxyStatusResponse(server=server, port=port, online=online, latency_ms=latency_ms)
