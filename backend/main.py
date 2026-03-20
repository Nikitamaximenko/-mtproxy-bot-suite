from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Generator, Literal
from uuid import UUID, uuid4

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
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


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ref_source: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


PaymentStatus = Literal["pending", "paid"]


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


logging.basicConfig(level=logging.INFO)


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
    ref_source: str | None = Field(default=None, max_length=64)


@app.post("/track-ref", response_model=OkResponse)
def track_ref(payload: TrackRefRequest, db: Session = Depends(get_db)) -> OkResponse:
    user = db.execute(select(User).where(User.telegram_id == payload.telegram_id)).scalar_one_or_none()
    if user is None:
        user = User(
            telegram_id=payload.telegram_id,
            username=payload.username,
            ref_source=payload.ref_source,
        )
        db.add(user)
        db.commit()
    elif payload.ref_source and not user.ref_source:
        user.ref_source = payload.ref_source
        if payload.username:
            user.username = payload.username
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

    import urllib.error
    import urllib.request

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
    if existing_user is None:
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
        token = uuid4()
        sub.payment_token = str(token)
        db.add(sub)
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

    return CheckoutCreateResponse(payment_url=payment_url, payment_token=token)


def activate_subscription(sub: Subscription) -> None:
    sub.payment_status = "paid"
    sub.expires_at = utcnow() + timedelta(days=30)
    sub.proxy_server = MT_PROXY_SERVER or "176.123.161.97"
    sub.proxy_port = MT_PROXY_PORT
    sub.proxy_secret = MT_PROXY_SECRET or "dd645eba01a59f188b5ba9db2564b44a00"


logger = logging.getLogger("mtproxy")

BOT_TOKEN = (os.getenv("BOT_TOKEN") or "").strip()
FRONTEND_URL = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
ADMIN_NOTIFY_CHAT_ID = (os.getenv("ADMIN_NOTIFY_CHAT_ID") or "").strip()


def _send_tg(tg_id: int, text: str, keyboard: dict | None = None) -> bool:
    """Send message via Telegram Bot API. Returns True if request completed without error."""
    if not BOT_TOKEN:
        return False
    try:
        import urllib.request
        body: dict[str, object] = {"chat_id": tg_id, "text": text, "parse_mode": "HTML"}
        if keyboard:
            body["reply_markup"] = keyboard
        data = json.dumps(body).encode()
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception as exc:
        logger.warning("Failed to send to tg_id=%s: %s", tg_id, exc)
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
    """Background loop: check expiring subscriptions every hour."""
    await asyncio.sleep(10)  # let the app start
    while True:
        try:
            _process_expiration_notifications()
        except Exception:
            logger.exception("Expiration check failed")
        await asyncio.sleep(3600)


@app.post("/webhooks/lava", response_model=OkResponse)
async def lava_webhook(req: Request, db: Session = Depends(get_db)) -> OkResponse:
    raw_body = await req.body()
    logger.info("Webhook received: headers=%s body=%s", dict(req.headers), raw_body[:500])

    if LAVA_TOP_WEBHOOK_API_KEY:
        got = (req.headers.get("x-api-key") or "").strip()
        if got != LAVA_TOP_WEBHOOK_API_KEY:
            logger.warning("Webhook key mismatch: got=%s expected=%s", got[:8], LAVA_TOP_WEBHOOK_API_KEY[:8])
            return OkResponse(ok=True)

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

    activate_subscription(sub)
    db.commit()
    logger.info("Subscription activated for tg_id=%s contract=%s", sub.telegram_id, contract_id)

    proxy_link = f"tg://proxy?server={sub.proxy_server}&port={sub.proxy_port}&secret={sub.proxy_secret}"
    _notify_payment_success(sub.telegram_id, proxy_link)
    _notify_admin_payment(sub.telegram_id)

    return OkResponse(ok=True)


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


ADMIN_API_KEY = (os.getenv("ADMIN_API_KEY") or "").strip()


def _require_admin(req: Request) -> None:
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Admin API not configured")
    got = (req.headers.get("x-admin-key") or "").strip()
    if got != ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden")


class LavaTestRequest(BaseModel):
    payment_token: UUID


@app.post("/webhooks/lava/test", response_model=OkResponse)
def lava_test(payload: LavaTestRequest, req: Request, db: Session = Depends(get_db)) -> OkResponse:
    _require_admin(req)
    sub = db.execute(select(Subscription).where(Subscription.payment_token == str(payload.payment_token))).scalar_one_or_none()
    if sub is None:
        raise HTTPException(status_code=404, detail="Subscription not found for payment_token")

    activate_subscription(sub)
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
    """
    _require_admin(req)
    if not BOT_TOKEN:
        raise HTTPException(status_code=503, detail="BOT_TOKEN is not configured on backend")

    import time

    rows = db.execute(select(User.telegram_id)).scalars().all()
    # Уникальные id, стабильный порядок
    seen: set[int] = set()
    ids: list[int] = []
    for raw in rows:
        uid = int(raw)
        if uid not in seen:
            seen.add(uid)
            ids.append(uid)

    msg = payload.message.strip()
    sent = 0
    failed = 0
    for uid in ids:
        if _send_tg(uid, msg):
            sent += 1
        else:
            failed += 1
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
    for sub in subs:
        sub.payment_status = "expired"
    db.commit()
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

    activate_subscription(sub)
    db.commit()
    return OkResponse(ok=True)


# ── Admin Dashboard API ──


class RefStat(BaseModel):
    source: str
    count: int


class AdminStatsResponse(BaseModel):
    total_users: int
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
        active_subscriptions=active,
        expired_subscriptions=expired,
        pending_payments=pending,
        revenue_estimate=total_paid * PAYMENT_AMOUNT_RUB,
        referrals=referrals,
    )


class SubInfo(BaseModel):
    id: int
    telegram_id: int
    payment_status: str
    expires_at: datetime | None
    created_at: datetime
    has_proxy: bool


class AdminSubsResponse(BaseModel):
    subscriptions: list[SubInfo]
    total: int


@app.get("/admin/subscriptions", response_model=AdminSubsResponse)
def admin_subscriptions(req: Request, db: Session = Depends(get_db)) -> AdminSubsResponse:
    _require_admin(req)
    subs = db.execute(
        select(Subscription).order_by(Subscription.created_at.desc()).limit(100)
    ).scalars().all()

    items = [
        SubInfo(
            id=s.id,
            telegram_id=s.telegram_id,
            payment_status=s.payment_status,
            expires_at=s.expires_at,
            created_at=s.created_at,
            has_proxy=bool(s.proxy_server and s.proxy_port and s.proxy_secret),
        )
        for s in subs
    ]
    return AdminSubsResponse(subscriptions=items, total=len(items))


@app.get("/admin/users", response_model=AdminSubsResponse)
def admin_users(req: Request, db: Session = Depends(get_db)) -> AdminSubsResponse:
    """Unique users with their latest subscription status (one row per telegram_id)."""
    _require_admin(req)
    latest_subq = (
        select(
            Subscription.telegram_id.label("tg_id"),
            func.max(Subscription.created_at).label("max_created"),
        )
        .group_by(Subscription.telegram_id)
    ).subquery()

    subs = (
        db.execute(
            select(Subscription)
            .join(
                latest_subq,
                and_(
                    Subscription.telegram_id == latest_subq.c.tg_id,
                    Subscription.created_at == latest_subq.c.max_created,
                ),
            )
            .order_by(Subscription.created_at.desc())
            .limit(100)
        )
        .scalars().all()
    )

    items = [
        SubInfo(
            id=s.id,
            telegram_id=s.telegram_id,
            payment_status=s.payment_status,
            expires_at=s.expires_at,
            created_at=s.created_at,
            has_proxy=bool(s.proxy_server and s.proxy_port and s.proxy_secret),
        )
        for s in subs
    ]
    return AdminSubsResponse(subscriptions=items, total=len(items))


class ProxyStatusResponse(BaseModel):
    server: str
    port: int
    online: bool
    latency_ms: float | None


@app.get("/admin/proxy-status", response_model=ProxyStatusResponse)
def admin_proxy_status(req: Request) -> ProxyStatusResponse:
    _require_admin(req)
    server = MT_PROXY_SERVER or "176.123.161.97"
    port = MT_PROXY_PORT

    online = False
    latency_ms: float | None = None
    try:
        import time
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

