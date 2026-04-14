from __future__ import annotations

import asyncio
import hashlib
import threading
import hmac
import html
import json
import logging
import os
import re
import socket
import time
import urllib.error
import urllib.request
from urllib.parse import quote, urljoin
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncGenerator, Generator, Literal
from uuid import UUID, uuid4

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Integer,
    String,
    and_,
    create_engine,
    delete,
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
# Второй поток оплаты (Prodamus / СБП). Пока выключен — не создаём чекаут; вебхук остаётся для уже начатых оплат.
ENABLE_PRODAMUS_CHECKOUT = (os.getenv("ENABLE_PRODAMUS_CHECKOUT") or "").strip().lower() in (
    "1",
    "true",
    "yes",
)
# Короткая ссылка с do=link иногда приходит отдельным URL без контекста urlSuccess; по умолчанию отдаём полную ссылку.
PRODAMUS_USE_SHORT_LINK = (os.getenv("PRODAMUS_USE_SHORT_LINK") or "false").strip().lower() in (
    "1",
    "true",
    "yes",
)

BOT_TOKEN = (os.getenv("BOT_TOKEN") or "").strip()
FRONTEND_URL = (os.getenv("FRONTEND_URL") or "").strip().rstrip("/")
MINIAPP_PATH = (os.getenv("MINIAPP_PATH") or "/mini").strip() or "/mini"
ADMIN_NOTIFY_CHAT_ID = (os.getenv("ADMIN_NOTIFY_CHAT_ID") or "").strip()

# WireGuard VPN via wg-easy (https://github.com/wg-easy/wg-easy)
WG_EASY_URL = (os.getenv("WG_EASY_URL") or "").strip().rstrip("/")
WG_EASY_PASSWORD = (os.getenv("WG_EASY_PASSWORD") or "").strip()
WG_SERVER_LOCATION = (os.getenv("WG_SERVER_LOCATION") or "Netherlands").strip()

# VLESS Reality VPN via 3X-UI (Xray)
XRAY_API_URL = (os.getenv("XRAY_API_URL") or "").strip().rstrip("/")
XRAY_USERNAME = (os.getenv("XRAY_USERNAME") or "admin").strip()
XRAY_PASSWORD = (os.getenv("XRAY_PASSWORD") or "").strip()
XRAY_INBOUND_ID = int((os.getenv("XRAY_INBOUND_ID") or "1").strip() or "1")
XRAY_PUBLIC_KEY = (os.getenv("XRAY_PUBLIC_KEY") or "").strip()
XRAY_SHORT_ID = (os.getenv("XRAY_SHORT_ID") or "").strip()
XRAY_SNI = (os.getenv("XRAY_SNI") or "www.microsoft.com").strip()
XRAY_SERVER_IP = (os.getenv("XRAY_SERVER_IP") or "").strip()


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
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)
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
    # Ручное отключение в админке: не меняет оплаченный период (expires_at), только снимает доступ к прокси.
    access_suspended: Mapped[bool] = mapped_column(Boolean, default=False, server_default=sa_false(), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class VpnPeer(Base):
    """One WireGuard peer per user, managed via wg-easy."""
    __tablename__ = "vpn_peers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    wg_client_id: Mapped[str] = mapped_column(String(64), nullable=False)
    server_location: Mapped[str] = mapped_column(String(64), default="Netherlands", nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class VpnClient(Base):
    """One VLESS Reality client per user, managed via 3X-UI."""
    __tablename__ = "vpn_clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    uuid: Mapped[str] = mapped_column(String(36), nullable=False)
    vless_link: Mapped[str] = mapped_column(String(1024), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    max_devices: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    devices_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    traffic_limit_gb: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 0 = unlimited
    traffic_used_bytes: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
            if "access_suspended" not in existing:
                if engine.dialect.name == "postgresql":
                    conn.execute(
                        text("ALTER TABLE subscriptions ADD COLUMN access_suspended BOOLEAN NOT NULL DEFAULT FALSE")
                    )
                else:
                    conn.execute(text("ALTER TABLE subscriptions ADD COLUMN access_suspended BOOLEAN NOT NULL DEFAULT 0"))
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
            if "email" not in existing:
                conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(255)"))

    # vpn_peers: new table, created by create_all on first run; no ALTER needed for existing columns.

    if "vpn_clients" in tables:
        existing = {c["name"] for c in inspector.get_columns("vpn_clients")}
        with engine.begin() as conn:
            if "active" not in existing:
                if engine.dialect.name == "postgresql":
                    conn.execute(text("ALTER TABLE vpn_clients ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE"))
                else:
                    conn.execute(text("ALTER TABLE vpn_clients ADD COLUMN active BOOLEAN NOT NULL DEFAULT 1"))
            if "max_devices" not in existing:
                conn.execute(text("ALTER TABLE vpn_clients ADD COLUMN max_devices INTEGER NOT NULL DEFAULT 1"))
            if "devices_count" not in existing:
                conn.execute(text("ALTER TABLE vpn_clients ADD COLUMN devices_count INTEGER NOT NULL DEFAULT 0"))
            if "traffic_limit_gb" not in existing:
                conn.execute(text("ALTER TABLE vpn_clients ADD COLUMN traffic_limit_gb INTEGER NOT NULL DEFAULT 0"))
            if "traffic_used_bytes" not in existing:
                conn.execute(text("ALTER TABLE vpn_clients ADD COLUMN traffic_used_bytes BIGINT NOT NULL DEFAULT 0"))
            if "last_sync_at" not in existing:
                if engine.dialect.name == "postgresql":
                    conn.execute(text("ALTER TABLE vpn_clients ADD COLUMN last_sync_at TIMESTAMP WITH TIME ZONE"))
                else:
                    conn.execute(text("ALTER TABLE vpn_clients ADD COLUMN last_sync_at DATETIME"))

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
    vpn_task = asyncio.create_task(_vpn_maintenance_loop())
    yield
    task.cancel()
    vpn_task.cancel()


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
    telegram_id: int = Field(..., ge=0)
    username: str | None = Field(default=None, max_length=64)
    email: str | None = Field(default=None, max_length=255)
    customer_email: str | None = Field(default=None)

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


def _create_lava_top_invoice(
    email: str,
    buyer_email: str | None = None,
    success_url: str | None = None,
) -> tuple[str, str | None]:
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
    if buyer_email:
        payload["buyer_email"] = buyer_email
    if success_url:
        payload["successUrl"] = success_url

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
    import random
    tg_id = int(payload.telegram_id)
    if tg_id == 0:
        tg_id = -random.randint(100000, 999999999)
    username = payload.username.strip() if payload.username else None
    email = payload.email.strip().lower() if payload.email else None
    customer_email = payload.customer_email.strip().lower() if payload.customer_email else None
    effective_email = email or customer_email
    logger.info("Checkout create: tg_id=%s email=%s", tg_id, effective_email or "(none)")

    existing_user = db.execute(select(User).where(User.telegram_id == tg_id)).scalar_one_or_none()
    is_new_user = existing_user is None
    if is_new_user:
        web_username = username or customer_email
        db.add(User(telegram_id=tg_id, username=web_username, email=effective_email))
    else:
        if username and existing_user.username != username:
            existing_user.username = username
        if effective_email and not existing_user.email:
            existing_user.email = effective_email

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
                web_username = username or customer_email
                db.add(User(telegram_id=tg_id, username=web_username, email=effective_email))
        db.commit()

    lava_contract_id: str | None = None
    lava_top_configured = bool(LAVA_TOP_API_KEY and LAVA_TOP_OFFER_ID)
    if effective_email and lava_top_configured:
        try:
            success_url = f"{FRONTEND_URL}/success?token={token}" if FRONTEND_URL else None
            payment_url, lava_contract_id = _create_lava_top_invoice(
                effective_email,
                buyer_email=customer_email,
                success_url=success_url,
            )
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


def _apply_proxy_credentials(sub: Subscription) -> None:
    """Выдать MTProxy-учётные данные без смены оплаченного периода."""
    if not MT_PROXY_SERVER:
        raise RuntimeError("MT_PROXY_SERVER is not configured")
    if not MT_PROXY_SECRET:
        raise RuntimeError("MT_PROXY_SECRET is not configured")
    sub.proxy_server = MT_PROXY_SERVER
    sub.proxy_port = MT_PROXY_PORT
    sub.proxy_secret = MT_PROXY_SECRET


def activate_subscription(sub: Subscription) -> None:
    """
    Активация после оплаты (или тестового гранта): 30 дней с момента вызова, статус paid, прокси включён.
    Для восстановления доступа по уже оплаченному окну без сдвига дат — см. admin_activate + access_suspended.
    """
    _apply_proxy_credentials(sub)
    sub.payment_status = "paid"
    sub.expires_at = utcnow() + timedelta(days=30)
    sub.access_suspended = False


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
            f"{g}, коротко напомню: <b>Frosty</b> — это не просто прокси.\n\n"
            "📡 <b>MTProxy</b> — Telegram работает без ограничений, ничего включать не нужно\n"
            "🛡 <b>VPN</b> — Instagram, TikTok, YouTube тоже открываются\n\n"
            f"Всё вместе за <b>{price} ₽/мес</b> — меньше стакана кофе.{ref_line}\n\n"
            "<i>Не хотите напоминания — команда /stop</i>"
        )
    if step == 2:
        return (
            f"{g}, многие думают, что прокси — только для Telegram. "
            "В <b>Frosty</b> ещё и WireGuard VPN для всего остального.\n\n"
            "Один раз настроил — работают и Telegram, и Instagram, и всё что нужно.\n\n"
            f"<b>{price} ₽/мес</b> · 10 ₽/день · без ограничений по трафику.{ref_line}\n\n"
            "<i>Отписаться от напоминаний: /stop</i>"
        )
    return (
        f"{g}, последний раз: если Telegram тормозит или Instagram не открывается — "
        "Frosty решает обе проблемы сразу.\n\n"
        f"<b>{price} ₽/мес</b>. Подключение за 2 минуты.{ref_line}\n\n"
        "<i>/stop — больше не пришлём</i>"
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
            # Deactivate VPN client when subscription expires
            try:
                _deactivate_vpn_client_no_commit(int(sub.telegram_id), db)
            except Exception:
                logger.exception("Failed to deactivate VPN for expired tg_id=%s", sub.telegram_id)

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


async def _vpn_maintenance_loop() -> None:
    """Background loop: VPN traffic sync every 10 minutes."""
    await asyncio.sleep(30)  # short initial delay, after main loop starts
    loop = asyncio.get_event_loop()
    while True:
        try:
            await loop.run_in_executor(None, _process_vpn_traffic_sync)
        except Exception:
            logger.exception("VPN traffic sync failed")
        await asyncio.sleep(600)  # 10 minutes


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

    # Auto-create VLESS client (best effort — don't fail the webhook on error)
    if XRAY_API_URL and int(sub.telegram_id) > 0:
        try:
            _ensure_xray_client(int(sub.telegram_id), db)
        except Exception:
            logger.exception("Failed to auto-create VLESS client for tg_id=%s", sub.telegram_id)

    proxy_link = f"tg://proxy?server={sub.proxy_server}&port={sub.proxy_port}&secret={sub.proxy_secret}"
    _notify_payment_success(sub.telegram_id, proxy_link)
    _notify_admin_payment(sub.telegram_id)

    return OkResponse(ok=True)


async def _parse_prodamus_webhook_payload(req: Request) -> dict[str, Any]:
    """Prodamus шлёт JSON или form (urlencoded / multipart)."""
    ct = (req.headers.get("content-type") or "").lower()
    if "application/x-www-form-urlencoded" in ct or "multipart/form-data" in ct:
        try:
            form = await req.form()
        except Exception:
            return {}
        out: dict[str, Any] = {}
        for k, v in form.multi_items():
            if hasattr(v, "read"):
                try:
                    raw = await v.read()
                    out[str(k)] = raw.decode("utf-8", errors="replace")
                except Exception:
                    out[str(k)] = str(v)
            else:
                out[str(k)] = str(v)
        return out
    raw = await req.body()
    logger.info("Prodamus webhook raw len=%s prefix=%s", len(raw), raw[:120])
    if not raw or not raw.strip():
        return {}
    if raw.strip()[:1] in (b"{", b"["):
        parsed = json.loads(raw.decode("utf-8"))
        return parsed if isinstance(parsed, dict) else {}
    from urllib.parse import parse_qs

    qs = parse_qs(raw.decode("utf-8"), keep_blank_values=True)
    return {k: (v[0] if v else "") for k, v in qs.items()}


def _flatten_prodamus_submit(payload: dict[str, Any]) -> dict[str, Any]:
    """В JSON-колбэке часто есть вложенный submit — сливаем поля для order_id / payment_status."""
    out: dict[str, Any] = dict(payload)
    sub = out.get("submit")
    if isinstance(sub, str) and sub.strip().startswith("{"):
        try:
            sub = json.loads(sub)
        except json.JSONDecodeError:
            sub = None
    if isinstance(sub, dict):
        for k, v in sub.items():
            if k not in out or out[k] in ("", None):
                out[k] = v
    return out


def _prodamus_signature_ok(req: Request, payload: dict[str, Any], secret: str) -> bool:
    """Подпись: поле signature в теле или заголовок Sign.

    Пробуем оба варианта экранирования слэшей:
    - True  -> old PHP json_encode (escapes slashes)
    - False -> PHP JSON_UNESCAPED_SLASHES (leaves slashes as-is)
    """
    submit = payload.get("submit")
    if isinstance(submit, str) and submit.strip().startswith("{"):
        try:
            submit = json.loads(submit)
        except json.JSONDecodeError:
            submit = None
    header_sign = (req.headers.get("Sign") or req.headers.get("sign") or "").strip()

    def _check(data: dict[str, Any], received: str) -> bool:
        for esc in (True, False):
            if hmac.compare_digest(_prodamus_sign(data, secret, escape_slashes=esc), received):
                return True
        return False

    if isinstance(submit, dict) and header_sign:
        cand = {k: v for k, v in submit.items() if k != "signature"}
        if _check(cand, header_sign):
            return True

    got = str(payload.get("signature") or "").strip()
    if got:
        data_for_sign = {k: v for k, v in payload.items() if k != "signature"}
        if _check(data_for_sign, got):
            return True
        logger.warning(
            "Prodamus sign mismatch: keys=%s received=%s…",
            sorted(data_for_sign.keys()),
            got[:16],
        )

    if header_sign:
        flat = {k: v for k, v in payload.items() if str(k).lower() not in ("signature", "sign")}
        if flat and _check(flat, header_sign):
            return True

    # Variant 4: unsorted JSON (PHP json_encode without ksort) — inline signature field
    got = str(payload.get("signature") or "").strip()
    if got:
        data_for_sign = {k: v for k, v in payload.items() if k != "signature"}
        if data_for_sign and hmac.compare_digest(_prodamus_sign_no_sort(data_for_sign, secret), got):
            return True
    # Variant 4b: unsorted JSON vs Sign header
    if header_sign:
        flat_ns = {k: v for k, v in payload.items() if str(k).lower() not in ("signature", "sign")}
        if flat_ns and hmac.compare_digest(_prodamus_sign_no_sort(flat_ns, secret), header_sign):
            return True

    return False


_UUID_TOKEN = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)


def _prodamus_order_refs(payload: dict[str, Any]) -> list[str]:
    """Идентификаторы заказа для поиска Subscription.payment_token (UUID в БД)."""
    out: list[str] = []
    for key in ("order_num", "order_id", "OrderId", "orderNum", "merchant_order_id"):
        val = str(payload.get(key) or "").strip()
        if val and val not in out:
            out.append(val)
    for val in payload.values():
        if isinstance(val, str):
            for m in _UUID_TOKEN.findall(val):
                if m not in out:
                    out.append(m)
    return out


def _prodamus_payment_is_success(payload: dict[str, Any]) -> bool:
    st = str(payload.get("payment_status") or "").strip().lower()
    if st == "success":
        return True
    desc = str(payload.get("payment_status_description") or "").strip().lower()
    return "успеш" in desc or "успеш" in st


@app.post("/webhooks/prodamus")
async def prodamus_webhook(req: Request, db: Session = Depends(get_db)) -> PlainTextResponse:
    """Ответ с телом success и кодом 200 — ожидание Prodamus (см. официальный приём вебхука)."""
    if not PRODAMUS_SECRET_KEY:
        logger.warning("PRODAMUS_SECRET_KEY not set — rejecting webhook")
        raise HTTPException(status_code=401, detail="Webhook authentication not configured")

    try:
        payload_raw = await _parse_prodamus_webhook_payload(req)
    except json.JSONDecodeError as e:
        logger.warning("Prodamus webhook: invalid JSON: %s", e)
        raise HTTPException(status_code=400, detail="Invalid JSON") from e

    payload_data = _flatten_prodamus_submit(payload_raw)

    ct = (req.headers.get("content-type") or "").lower()
    logger.info(
        "Prodamus webhook: ct=%s keys=%s has_sig=%s has_sign_header=%s",
        ct.split(";")[0].strip(),
        sorted(payload_data.keys()),
        bool(str(payload_data.get("signature") or "").strip()),
        bool((req.headers.get("Sign") or req.headers.get("sign") or "").strip()),
    )

    if not _prodamus_signature_ok(req, payload_data, PRODAMUS_SECRET_KEY):
        logger.warning("Prodamus webhook rejected: invalid sign keys=%s", sorted(payload_data.keys()))
        raise HTTPException(status_code=401, detail="Unauthorized")

    order_candidates = _prodamus_order_refs(payload_data)
    logger.info("Prodamus webhook pay_ok=%s order_candidates=%s", _prodamus_payment_is_success(payload_data), order_candidates)

    if not _prodamus_payment_is_success(payload_data):
        return PlainTextResponse("success", status_code=200)

    sub: Subscription | None = None
    for ref in order_candidates:
        sub = db.execute(select(Subscription).where(Subscription.payment_token == ref)).scalar_one_or_none()
        if sub is not None:
            break
    if sub is None:
        logger.warning("Prodamus: no subscription for tokens=%s", order_candidates)
        return PlainTextResponse("success", status_code=200)

    try:
        activate_subscription(sub)
    except RuntimeError as e:
        logger.error("Prodamus activate_subscription failed: %s", e)
        raise HTTPException(status_code=503, detail=str(e)) from e

    db.commit()
    logger.info("Prodamus subscription activated tg_id=%s token=%s", sub.telegram_id, sub.payment_token)

    if XRAY_API_URL and int(sub.telegram_id) > 0:
        try:
            _ensure_xray_client(int(sub.telegram_id), db)
        except Exception:
            logger.exception("Failed to auto-create VLESS client for tg_id=%s (prodamus)", sub.telegram_id)

    proxy_link = f"tg://proxy?server={sub.proxy_server}&port={sub.proxy_port}&secret={sub.proxy_secret}"
    _notify_payment_success(sub.telegram_id, proxy_link)
    _notify_admin_payment(sub.telegram_id)

    return PlainTextResponse("success", status_code=200)


from collections.abc import MutableMapping as _MutableMapping


def _deep_int_to_string(dictionary: dict) -> None:
    """Рекурсивно приводит все значения словаря к строкам (in-place)."""
    for key, value in dictionary.items():
        if isinstance(value, _MutableMapping):
            _deep_int_to_string(value)
        elif isinstance(value, (list, tuple)):
            for k, v in enumerate(value):
                _deep_int_to_string({str(k): v})
        else:
            dictionary[key] = str(value)


def _http_build_query(dictionary: dict, parent_key: str | bool = False) -> dict:
    """PHP-совместимый http_build_query — раскрывает вложенные словари и списки."""
    items: list = []
    for key, value in dictionary.items():
        new_key = str(parent_key) + "[" + key + "]" if parent_key else key
        if isinstance(value, _MutableMapping):
            items.extend(_http_build_query(value, new_key).items())
        elif isinstance(value, (list, tuple)):
            for k, v in enumerate(value):
                items.extend(_http_build_query({str(k): v}, new_key).items())
        else:
            items.append((new_key, value))
    return dict(items)


def _prodamus_sign_no_sort(data: dict, secret: str) -> str:
    """Подпись без сортировки ключей — как PHP json_encode без JSON_UNESCAPED_SLASHES."""
    import copy
    data_copy = copy.deepcopy(data)
    _deep_int_to_string(data_copy)
    raw = json.dumps(data_copy, ensure_ascii=False, separators=(",", ":"))
    raw = raw.replace("/", "\\/")
    return hmac.new(secret.encode("utf8"), raw.encode("utf8"), hashlib.sha256).hexdigest()


def _prodamus_sign(data: dict, secret: str, escape_slashes: bool = True) -> str:
    """HMAC-SHA256 signature matching Prodamus/Payform PHP SDK.

    escape_slashes=True  -> PHP json_encode default (escapes / to backslash-/)
    escape_slashes=False -> PHP JSON_UNESCAPED_SLASHES (leaves / as-is)
    """
    import copy
    data_copy = copy.deepcopy(data)
    _deep_int_to_string(data_copy)
    json_str = json.dumps(data_copy, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    if escape_slashes:
        json_str = json_str.replace("/", "\\/")
    return hmac.new(secret.encode("utf8"), json_str.encode("utf8"), hashlib.sha256).hexdigest()


class ProdamusCheckoutRequest(BaseModel):
    telegram_id: int = Field(..., ge=0)
    username: str | None = Field(default=None, max_length=64)
    customer_email: str | None = Field(default=None, max_length=255)

    @field_validator("telegram_id", mode="before")
    @classmethod
    def _tg_id_from_str(cls, v: object) -> int:
        if isinstance(v, str):
            return int(v.strip())
        if isinstance(v, int):
            return v
        raise ValueError("telegram_id must be a non-negative integer")


class ProdamusCheckoutResponse(BaseModel):
    payment_url: str
    payment_token: UUID


@app.post("/checkout/create-prodamus", response_model=ProdamusCheckoutResponse)
def checkout_create_prodamus(payload: ProdamusCheckoutRequest, db: Session = Depends(get_db)) -> ProdamusCheckoutResponse:
    import random
    if not ENABLE_PRODAMUS_CHECKOUT:
        raise HTTPException(status_code=503, detail="Prodamus checkout is disabled")
    tg_id = int(payload.telegram_id)
    if tg_id == 0:
        tg_id = -random.randint(100000, 999999999)
    username = payload.username.strip() if payload.username else None
    customer_email = payload.customer_email.strip().lower() if payload.customer_email else None
    logger.info("Prodamus checkout create: tg_id=%s email=%s", tg_id, customer_email or "(none)")

    existing_user = db.execute(select(User).where(User.telegram_id == tg_id)).scalar_one_or_none()
    is_new_user = existing_user is None
    if is_new_user:
        web_username = username or customer_email
        db.add(User(telegram_id=tg_id, username=web_username, email=customer_email))
    else:
        if username and existing_user.username != username:
            existing_user.username = username
        if customer_email and not existing_user.email:
            existing_user.email = customer_email

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
                web_username = username or customer_email
                db.add(User(telegram_id=tg_id, username=web_username, email=customer_email))
        db.commit()

    from urllib.parse import urlencode as _urlencode

    # Base params shared between both URL variants
    base_params: dict = {
        "order_id": str(token),
        "products": [
            {
                "name": "Frosty MTProxy",
                "price": "299",
                "quantity": "1",
            }
        ],
        "callbackType": "json",
        "urlSuccess": (
            f"{FRONTEND_URL}/success?token={token}"
            + (f"&email={quote(customer_email)}" if (FRONTEND_URL and customer_email) else "")
            if FRONTEND_URL
            else ""
        ),
    }
    if PUBLIC_BASE_URL:
        base_params["urlNotification"] = f"{PUBLIC_BASE_URL}/webhooks/prodamus"
    if FRONTEND_URL:
        base_params["urlReturn"] = f"{FRONTEND_URL}/mini"
    if customer_email:
        base_params["customer_email"] = customer_email

    # ── Step 1: get short link via server-side do=link call ──────────────────
    # do=link tells Prodamus to return a plain-text shortlink instead of rendering
    # the payment form — ONLY correct for server-to-server calls, not browser navigation.
    link_params = {**base_params, "do": "link"}
    if PRODAMUS_SECRET_KEY:
        link_params["signature"] = _prodamus_sign(link_params, PRODAMUS_SECRET_KEY)
    link_query = _urlencode(_http_build_query(link_params))
    link_api_url = f"https://admaster.payform.ru/?{link_query}"

    payment_url: str | None = None
    try:
        req_obj = urllib.request.Request(link_api_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req_obj, timeout=10) as resp:
            body = resp.read().decode("utf-8").strip()
        if body.startswith("http"):
            payment_url = body
            logger.info("Prodamus short link ok tg_id=%s url=%s", tg_id, payment_url)
        else:
            logger.warning("Prodamus unexpected do=link response tg_id=%s: %s", tg_id, body[:300])
    except Exception as e:
        logger.error("Prodamus do=link request failed tg_id=%s: %s", tg_id, e)

    # ── Step 2: fallback — direct payment URL without do=link ────────────────
    # Without do=link the URL opens the payment form directly in a browser — safe to navigate to.
    if not payment_url:
        direct_params = dict(base_params)  # no "do" key
        if PRODAMUS_SECRET_KEY:
            direct_params["signature"] = _prodamus_sign(direct_params, PRODAMUS_SECRET_KEY)
        direct_query = _urlencode(_http_build_query(direct_params))
        payment_url = f"https://admaster.payform.ru/?{direct_query}"
        logger.info("Prodamus using direct URL fallback tg_id=%s", tg_id)

    return ProdamusCheckoutResponse(payment_url=payment_url, payment_token=token)


class SubscriptionResponse(BaseModel):
    active: bool
    expires_at: datetime | None = None
    proxy_link: str | None = None
    suspended: bool = False


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
        return SubscriptionResponse(active=False, expires_at=None, proxy_link=None, suspended=False)

    if sub.access_suspended:
        return SubscriptionResponse(active=False, expires_at=sub.expires_at, proxy_link=None, suspended=True)

    if not (sub.proxy_server and sub.proxy_port and sub.proxy_secret):
        return SubscriptionResponse(active=True, expires_at=sub.expires_at, proxy_link=None, suspended=False)

    proxy_link = f"tg://proxy?server={sub.proxy_server}&port={sub.proxy_port}&secret={sub.proxy_secret}"
    return SubscriptionResponse(active=True, expires_at=sub.expires_at, proxy_link=proxy_link, suspended=False)


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


class ClaimWebSubscriptionRequest(BaseModel):
    payment_token: str
    telegram_id: int
    username: str | None = None
    first_name: str | None = None


class ClaimWebSubscriptionResponse(BaseModel):
    ok: bool
    proxy_link: str | None = None
    error: str | None = None


@app.post("/subscription/claim-by-token", response_model=ClaimWebSubscriptionResponse)
def claim_web_subscription(
    body: ClaimWebSubscriptionRequest, db: Session = Depends(get_db)
) -> ClaimWebSubscriptionResponse:
    sub = db.execute(
        select(Subscription).where(
            Subscription.payment_token == body.payment_token,
            Subscription.payment_status == "paid",
        )
    ).scalar_one_or_none()

    if not sub:
        return ClaimWebSubscriptionResponse(ok=False, error="not_found")

    proxy_link: str | None = None
    if sub.proxy_server and sub.proxy_port and sub.proxy_secret:
        proxy_link = f"tg://proxy?server={sub.proxy_server}&port={sub.proxy_port}&secret={sub.proxy_secret}"

    # Already belongs to this user
    if sub.telegram_id == body.telegram_id:
        return ClaimWebSubscriptionResponse(ok=True, proxy_link=proxy_link)

    # Web user (negative tg_id) — transfer subscription to real Telegram user
    if sub.telegram_id < 0:
        old_tg_id = sub.telegram_id
        new_tg_id = body.telegram_id

        existing_user = db.execute(
            select(User).where(User.telegram_id == new_tg_id)
        ).scalar_one_or_none()

        old_user = db.execute(
            select(User).where(User.telegram_id == old_tg_id)
        ).scalar_one_or_none()

        sub.telegram_id = new_tg_id

        if existing_user:
            if old_user:
                db.delete(old_user)
        else:
            if old_user:
                old_user.telegram_id = new_tg_id
                if body.username:
                    old_user.username = body.username
                if body.first_name:
                    old_user.first_name = body.first_name
            else:
                db.add(User(telegram_id=new_tg_id, username=body.username, first_name=body.first_name))

        db.commit()

        if XRAY_API_URL:
            try:
                _ensure_xray_client(new_tg_id, db)
            except Exception:
                logger.exception("claim_web_subscription: xray client creation failed for tg_id=%s", new_tg_id)

        return ClaimWebSubscriptionResponse(ok=True, proxy_link=proxy_link)

    # Belongs to a different Telegram user
    return ClaimWebSubscriptionResponse(ok=False, error="belongs_to_other")


@app.get("/subscription/by-email/{email}")
def subscription_by_email(email: str, db: Session = Depends(get_db)):
    """Look up active subscription by the email stored at checkout time."""
    clean = email.strip().lower()
    # Match on User.email (preferred) or User.username when username was set to email for web users
    user = db.execute(
        select(User).where(
            (func.lower(User.email) == clean) | (func.lower(User.username) == clean)
        ).limit(1)
    ).scalar_one_or_none()
    if not user:
        return {"active": False}

    now = utcnow()
    sub = db.execute(
        select(Subscription)
        .where(
            Subscription.telegram_id == user.telegram_id,
            Subscription.payment_status == "paid",
            Subscription.expires_at.is_not(None),
            Subscription.expires_at > now,
        )
        .order_by(Subscription.expires_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    if not sub:
        return {"active": False}

    if sub.access_suspended:
        return {"active": False, "suspended": True, "expires_at": sub.expires_at}

    proxy_link: str | None = None
    if sub.proxy_server and sub.proxy_port and sub.proxy_secret:
        proxy_link = f"tg://proxy?server={sub.proxy_server}&port={sub.proxy_port}&secret={sub.proxy_secret}"

    return {"active": True, "proxy_link": proxy_link, "expires_at": sub.expires_at}


# ── wg-easy helpers ──────────────────────────────────────────────────────────

_wg_cookie: str | None = None
_wg_cookie_lock = threading.Lock()


def _wg_authenticate() -> str | None:
    if not WG_EASY_URL or not WG_EASY_PASSWORD:
        return None
    try:
        data = json.dumps({"password": WG_EASY_PASSWORD}).encode()
        req = urllib.request.Request(
            f"{WG_EASY_URL}/api/session",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw_cookie = resp.headers.get("Set-Cookie", "")
            # Extract the session token part (before first ';')
            return raw_cookie.split(";")[0] if raw_cookie else None
    except Exception as e:
        logger.warning("wg-easy auth failed: %s", e)
        return None


def _wg_req(method: str, path: str, body: dict | None = None) -> dict | bytes | None:
    global _wg_cookie

    def _do(cookie: str) -> tuple[int, dict | bytes]:
        url = f"{WG_EASY_URL}{path}"
        raw_body = json.dumps(body).encode() if body is not None else None
        headers: dict[str, str] = {"Cookie": cookie}
        if raw_body:
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=raw_body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = resp.read()
                ct = resp.headers.get("Content-Type", "")
                if "json" in ct:
                    return resp.status, json.loads(raw)
                return resp.status, raw
        except urllib.error.HTTPError as e:
            return e.code, b""

    with _wg_cookie_lock:
        if not _wg_cookie:
            _wg_cookie = _wg_authenticate()
        if not _wg_cookie:
            return None
        status, result = _do(_wg_cookie)
        if status == 401:
            _wg_cookie = _wg_authenticate()
            if not _wg_cookie:
                return None
            status, result = _do(_wg_cookie)
        return result if status < 300 else None


def _wg_create_client(name: str) -> str | None:
    result = _wg_req("POST", "/api/wireguard/client", {"name": name})
    if isinstance(result, dict):
        return result.get("id")
    return None


def _wg_enable_client(client_id: str) -> None:
    _wg_req("POST", f"/api/wireguard/client/{client_id}/enable")


def _wg_disable_client(client_id: str) -> None:
    _wg_req("POST", f"/api/wireguard/client/{client_id}/disable")


def _wg_get_config(client_id: str) -> str | None:
    result = _wg_req("GET", f"/api/wireguard/client/{client_id}/configuration")
    if isinstance(result, bytes):
        return result.decode("utf-8", errors="replace")
    return None


def _wg_get_qr(client_id: str) -> str | None:
    result = _wg_req("GET", f"/api/wireguard/client/{client_id}/qrcode.svg")
    if isinstance(result, bytes):
        return result.decode("utf-8", errors="replace")
    return None


# ── 3X-UI / Xray VLESS Reality helpers ──────────────────────────────────────

_xray_cookie: str | None = None
_xray_cookie_lock = threading.Lock()


def _xray_login() -> str | None:
    if not XRAY_API_URL or not XRAY_PASSWORD:
        return None
    try:
        data = json.dumps({"username": XRAY_USERNAME, "password": XRAY_PASSWORD}).encode()
        req = urllib.request.Request(
            f"{XRAY_API_URL}/login",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw_cookie = resp.headers.get("Set-Cookie", "")
            return raw_cookie.split(";")[0] if raw_cookie else None
    except Exception as e:
        logger.warning("3X-UI login failed: %s", e)
        return None


def _xray_req(method: str, path: str, body: dict | None = None) -> dict | None:
    global _xray_cookie

    def _do(cookie: str) -> tuple[int, dict | None]:
        url = f"{XRAY_API_URL}{path}"
        raw_body = json.dumps(body).encode() if body is not None else None
        headers: dict[str, str] = {"Cookie": cookie}
        if raw_body:
            headers["Content-Type"] = "application/json"
        req_obj = urllib.request.Request(url, data=raw_body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req_obj, timeout=15) as resp:
                raw = resp.read()
                return resp.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            return e.code, None

    with _xray_cookie_lock:
        if not _xray_cookie:
            _xray_cookie = _xray_login()
        if not _xray_cookie:
            return None
        status, result = _do(_xray_cookie)
        if status in (401, 403):
            _xray_cookie = _xray_login()
            if not _xray_cookie:
                return None
            status, result = _do(_xray_cookie)
        return result if status < 300 else None


def _xray_build_vless_link(client_uuid: str) -> str:
    if not (XRAY_SERVER_IP and XRAY_PUBLIC_KEY):
        return ""
    params = (
        f"security=reality&encryption=none&pbk={XRAY_PUBLIC_KEY}"
        f"&fp=chrome&type=tcp&sni={XRAY_SNI}&sid={XRAY_SHORT_ID}&spx=%2F"
    )
    return f"vless://{client_uuid}@{XRAY_SERVER_IP}:443?{params}#Frosty VPN"


def _xray_add_client(tg_id: int) -> tuple[str, str] | None:
    """Add a client to inbound XRAY_INBOUND_ID. Returns (uuid, vless_link) or None."""
    if not XRAY_API_URL:
        return None
    import uuid as _uuid_mod
    client_uuid = str(_uuid_mod.uuid4())
    vless_link = _xray_build_vless_link(client_uuid)
    payload = {
        "id": XRAY_INBOUND_ID,
        "settings": json.dumps({
            "clients": [{
                "id": client_uuid,
                "flow": "",
                "email": f"frosty_{tg_id}",
                "limitIp": 0,
                "totalGB": 0,
                "expiryTime": 0,
                "enable": True,
                "tgId": str(tg_id),
                "subId": "",
            }]
        }),
    }
    result = _xray_req("POST", "/panel/api/inbounds/addClient", payload)
    if result and result.get("success"):
        return client_uuid, vless_link
    logger.warning("3X-UI addClient failed for tg_id=%s: %s", tg_id, result)
    return None


def _xray_get_online_count() -> int:
    """Returns number of currently connected Xray clients."""
    result = _xray_req("POST", "/panel/api/inbounds/onlines")
    if isinstance(result, dict) and result.get("success"):
        obj = result.get("obj") or []
        if isinstance(obj, list):
            return len(obj)
    return 0


def _xray_get_client_traffic(email: str) -> tuple[int, int]:
    """Returns (up_bytes, down_bytes) for a client email. (0, 0) on error."""
    result = _xray_req("GET", f"/panel/api/inbounds/clientTraffics/{email}")
    if isinstance(result, dict) and result.get("success"):
        obj = result.get("obj") or {}
        if isinstance(obj, dict):
            return int(obj.get("up", 0)), int(obj.get("down", 0))
    return 0, 0


def _xray_delete_client(client_uuid: str) -> bool:
    """Delete a client from 3X-UI inbound. Returns True on success."""
    result = _xray_req("POST", f"/panel/api/inbounds/{XRAY_INBOUND_ID}/delClient/{client_uuid}")
    return isinstance(result, dict) and result.get("success", False)


def _ensure_xray_client(tg_id: int, db: Session) -> tuple[str, str] | None:
    """Return existing active client or create a new one. Returns (uuid, vless_link) or None."""
    existing = db.execute(select(VpnClient).where(VpnClient.telegram_id == tg_id)).scalar_one_or_none()
    if existing:
        if existing.active:
            return existing.uuid, existing.vless_link
        # Previously deactivated — recreate in 3X-UI with a fresh UUID
        result = _xray_add_client(tg_id)
        if not result:
            return None
        client_uuid, vless_link = result
        existing.uuid = client_uuid
        existing.vless_link = vless_link
        existing.active = True
        existing.traffic_used_bytes = 0
        db.commit()
        return client_uuid, vless_link
    # Brand new client
    result = _xray_add_client(tg_id)
    if not result:
        return None
    client_uuid, vless_link = result
    vpn_client = VpnClient(telegram_id=tg_id, uuid=client_uuid, vless_link=vless_link)
    db.add(vpn_client)
    db.commit()
    return client_uuid, vless_link


def _deactivate_vpn_client_no_commit(tg_id: int, db: Session) -> None:
    """Mark VPN client inactive and delete from 3X-UI. Caller must commit the session."""
    client = db.execute(select(VpnClient).where(VpnClient.telegram_id == tg_id)).scalar_one_or_none()
    if not client or not client.active:
        return
    if XRAY_API_URL:
        try:
            ok = _xray_delete_client(client.uuid)
            if not ok:
                logger.warning("3X-UI delClient failed for tg_id=%s uuid=%s", tg_id, client.uuid)
        except Exception:
            logger.exception("3X-UI delClient error for tg_id=%s", tg_id)
    client.active = False
    logger.info("VPN client marked inactive for tg_id=%s", tg_id)


def deactivate_vpn_client(tg_id: int, db: Session) -> None:
    """Deactivate VPN client and commit. Public API for endpoints."""
    _deactivate_vpn_client_no_commit(tg_id, db)
    db.commit()


def _process_vpn_traffic_sync() -> None:
    """Sync traffic stats from 3X-UI and deactivate over-limit clients."""
    if not XRAY_API_URL:
        return
    db = SessionLocal()
    try:
        now = utcnow()
        clients = db.execute(
            select(VpnClient).where(VpnClient.active == True)  # noqa: E712
        ).scalars().all()

        deactivated = 0
        synced = 0
        for client in clients:
            email = f"frosty_{client.telegram_id}"
            try:
                up, down = _xray_get_client_traffic(email)
                total = up + down
                client.traffic_used_bytes = total
                client.last_sync_at = now
                synced += 1
                # Enforce traffic limit (0 = unlimited)
                if client.traffic_limit_gb > 0:
                    limit_bytes = client.traffic_limit_gb * 1024 * 1024 * 1024
                    if total >= limit_bytes:
                        logger.info("Traffic limit exceeded for tg_id=%s (%d GB), deactivating", client.telegram_id, client.traffic_limit_gb)
                        _deactivate_vpn_client_no_commit(int(client.telegram_id), db)
                        deactivated += 1
            except Exception:
                logger.exception("Failed to sync traffic for tg_id=%s", client.telegram_id)

        db.commit()
        logger.info("VPN traffic sync: %d clients synced, %d deactivated", synced, deactivated)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ── VPN endpoints ────────────────────────────────────────────────────────────

class VpnStatusResponse(BaseModel):
    available: bool
    enabled: bool
    location: str
    config: str | None
    qr_svg: str | None


class VpnToggleRequest(BaseModel):
    enabled: bool


class VpnToggleResponse(BaseModel):
    ok: bool
    enabled: bool


def _active_sub_for_vpn(telegram_id: int, db: Session) -> bool:
    now = utcnow()
    stmt = (
        select(Subscription.id)
        .where(
            Subscription.telegram_id == telegram_id,
            Subscription.payment_status == "paid",
            Subscription.expires_at > now,
            Subscription.access_suspended == False,  # noqa: E712
        )
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none() is not None


@app.get("/vpn/status/{telegram_id}", response_model=VpnStatusResponse)
def vpn_status(telegram_id: int, db: Session = Depends(get_db)) -> VpnStatusResponse:
    if not _active_sub_for_vpn(telegram_id, db):
        raise HTTPException(status_code=403, detail="No active subscription")

    if not WG_EASY_URL:
        return VpnStatusResponse(available=False, enabled=False, location=WG_SERVER_LOCATION, config=None, qr_svg=None)

    peer = db.execute(select(VpnPeer).where(VpnPeer.telegram_id == telegram_id)).scalar_one_or_none()

    if not peer:
        client_id = _wg_create_client(f"frosty_{telegram_id}")
        if not client_id:
            logger.error("wg-easy: failed to create peer for %s", telegram_id)
            return VpnStatusResponse(available=True, enabled=False, location=WG_SERVER_LOCATION, config=None, qr_svg=None)
        peer = VpnPeer(telegram_id=telegram_id, wg_client_id=client_id, server_location=WG_SERVER_LOCATION, enabled=True)
        db.add(peer)
        db.commit()
        db.refresh(peer)

    config = _wg_get_config(peer.wg_client_id) if peer.enabled else None
    qr_svg = _wg_get_qr(peer.wg_client_id) if peer.enabled else None

    return VpnStatusResponse(
        available=True,
        enabled=peer.enabled,
        location=peer.server_location,
        config=config,
        qr_svg=qr_svg,
    )


@app.post("/vpn/toggle/{telegram_id}", response_model=VpnToggleResponse)
def vpn_toggle(telegram_id: int, payload: VpnToggleRequest, db: Session = Depends(get_db)) -> VpnToggleResponse:
    if not _active_sub_for_vpn(telegram_id, db):
        raise HTTPException(status_code=403, detail="No active subscription")

    if not WG_EASY_URL:
        raise HTTPException(status_code=503, detail="VPN not configured")

    peer = db.execute(select(VpnPeer).where(VpnPeer.telegram_id == telegram_id)).scalar_one_or_none()

    if not peer:
        client_id = _wg_create_client(f"frosty_{telegram_id}")
        if not client_id:
            raise HTTPException(status_code=503, detail="Failed to create VPN peer")
        peer = VpnPeer(telegram_id=telegram_id, wg_client_id=client_id, server_location=WG_SERVER_LOCATION, enabled=payload.enabled)
        db.add(peer)
    else:
        peer.enabled = payload.enabled

    if payload.enabled:
        _wg_enable_client(peer.wg_client_id)
    else:
        _wg_disable_client(peer.wg_client_id)

    db.commit()
    logger.info("VPN toggle: tg_id=%s enabled=%s", telegram_id, payload.enabled)
    return VpnToggleResponse(ok=True, enabled=peer.enabled)


# ── VLESS Reality endpoints ───────────────────────────────────────────────────

class VpnConfigResponse(BaseModel):
    available: bool
    reason: str | None = None  # "no_subscription" | "vpn_not_configured" | "creating"
    vless_link: str | None = None
    uuid: str | None = None


@app.get("/vpn/config/{telegram_id}", response_model=VpnConfigResponse)
def vpn_config(telegram_id: int, db: Session = Depends(get_db)) -> VpnConfigResponse:
    if not _active_sub_for_vpn(telegram_id, db):
        # Return 200 with reason so frontend can differentiate without catching 403
        return VpnConfigResponse(available=False, reason="no_subscription")

    if not XRAY_API_URL:
        return VpnConfigResponse(available=False, reason="vpn_not_configured")

    result = _ensure_xray_client(telegram_id, db)
    if not result:
        return VpnConfigResponse(available=True, reason="creating")

    client_uuid, vless_link = result
    return VpnConfigResponse(available=True, vless_link=vless_link, uuid=client_uuid)


class VpnOnlineResponse(BaseModel):
    online: int


@app.get("/vpn/online", response_model=VpnOnlineResponse)
def vpn_online(req: Request) -> VpnOnlineResponse:
    _require_admin(req)
    return VpnOnlineResponse(online=_xray_get_online_count())


# ── Free proxy (no subscription required) ────────────────────────────────────

class FreeProxyResponse(BaseModel):
    server: str
    port: int
    secret: str
    proxy_link: str


@app.get("/proxy/free", response_model=FreeProxyResponse)
def free_proxy() -> FreeProxyResponse:
    server = MT_PROXY_SERVER or "176.123.161.97"
    port = MT_PROXY_PORT if MT_PROXY_PORT else 443
    secret = MT_PROXY_SECRET or "dd645eba01a59f188b5ba9db2564b44a00"
    proxy_link = f"tg://proxy?server={server}&port={port}&secret={secret}"
    return FreeProxyResponse(server=server, port=port, secret=secret, proxy_link=proxy_link)


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


class BroadcastQueuedResponse(BaseModel):
    ok: bool
    queued: bool
    total: int   # сколько получателей поставлено в очередь


class BroadcastStatusResponse(BaseModel):
    running: bool
    done: bool
    total: int
    sent: int
    failed: int
    error: str | None
    started_at: str | None


# --- Глобальное состояние фоновой рассылки (один процесс Railway) ---
_bcast_lock = threading.Lock()
_bcast_state: dict = {
    "running": False, "done": False,
    "total": 0, "sent": 0, "failed": 0,
    "error": None, "started_at": None,
}


def _broadcast_worker(ids: list[int], msg: str, kb: dict | None) -> None:
    with _bcast_lock:
        _bcast_state.update(running=True, done=False, total=len(ids),
                            sent=0, failed=0, error=None,
                            started_at=utcnow().isoformat())
    logger.info("Broadcast worker started: %s recipients", len(ids))
    try:
        for uid in ids:
            ok = _send_tg(uid, msg, kb)
            with _bcast_lock:
                if ok:
                    _bcast_state["sent"] += 1
                else:
                    _bcast_state["failed"] += 1
            time.sleep(0.05)  # ~20 msg/s, мягче к лимитам Telegram
    except Exception as exc:
        with _bcast_lock:
            _bcast_state["error"] = str(exc)
        logger.exception("Broadcast worker error: %s", exc)
    finally:
        with _bcast_lock:
            _bcast_state["running"] = False
            _bcast_state["done"] = True
        logger.info("Broadcast worker done: sent=%s failed=%s",
                    _bcast_state["sent"], _bcast_state["failed"])


@app.post("/admin/broadcast", response_model=BroadcastQueuedResponse)
def admin_broadcast(payload: BroadcastRequest, req: Request, db: Session = Depends(get_db)) -> BroadcastQueuedResponse:
    """
    Ставит рассылку в очередь (фоновый поток) и сразу возвращает ответ.
    Статус отслеживать через GET /admin/broadcast-status.
    """
    _require_admin(req)
    if not BOT_TOKEN:
        raise HTTPException(status_code=503, detail="BOT_TOKEN is not configured on backend")

    with _bcast_lock:
        if _bcast_state["running"]:
            raise HTTPException(status_code=409, detail="Рассылка уже выполняется — дождитесь завершения")

    q = select(User.telegram_id).where(User.telegram_id > 0)
    if not payload.include_opted_out:
        q = q.where(User.marketing_opt_out == False)  # noqa: E712
    rows = db.execute(q).scalars().all()
    seen: set[int] = set()
    ids: list[int] = []
    for raw in rows:
        uid = int(raw)
        if uid not in seen:
            seen.add(uid)
            ids.append(uid)

    logger.info("Broadcast queued: %s recipients", len(ids))

    msg = payload.message.strip()
    kb: dict | None = None
    if payload.button_text and payload.button_url:
        kb = {"inline_keyboard": [[{"text": payload.button_text, "url": payload.button_url}]]}

    t = threading.Thread(target=_broadcast_worker, args=(ids, msg, kb), daemon=True)
    t.start()

    return BroadcastQueuedResponse(ok=True, queued=True, total=len(ids))


@app.get("/admin/broadcast-status", response_model=BroadcastStatusResponse)
def admin_broadcast_status(req: Request) -> BroadcastStatusResponse:
    """Текущий статус фоновой рассылки."""
    _require_admin(req)
    with _bcast_lock:
        s = dict(_bcast_state)
    return BroadcastStatusResponse(**s)


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
        # Не трогаем expires_at и payment_status — только снимаем доступ (оплаченный период сохраняется).
        sub.access_suspended = True
        sub.proxy_server = None
        sub.proxy_port = None
        sub.proxy_secret = None
    db.commit()
    logger.info("Admin suspended access for tg_id=%s (%d row(s))", telegram_id, len(subs))
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
                "access_suspended": bool(s.access_suspended),
            }
            for s in subs
        ],
    )


@app.post("/admin/activate/{telegram_id}", response_model=OkResponse)
def admin_activate(telegram_id: int, req: Request, db: Session = Depends(get_db)) -> OkResponse:
    """
    Восстановить доступ к прокси. Если подписка уже оплачена и срок ещё не вышел — только снимаем
    access_suspended и выдаём прокси, без сдвига expires_at (даты привязаны к оплате).
    Иначе — полная активация на 30 дней (тестовый грант / истёкший период).
    """
    _require_admin(req)
    now = utcnow()

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
            payment_status="pending",
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)

    if sub.payment_status == "paid" and sub.expires_at is not None and sub.expires_at > now:
        try:
            _apply_proxy_credentials(sub)
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=str(e))
        sub.access_suspended = False
        db.commit()
        logger.info("Admin restored proxy for paid tg_id=%s (expires_at unchanged)", telegram_id)
        return OkResponse(ok=True)

    try:
        activate_subscription(sub)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    db.commit()
    logger.info("Admin granted full activation for tg_id=%s", telegram_id)

    if XRAY_API_URL and int(telegram_id) > 0:
        try:
            _ensure_xray_client(int(telegram_id), db)
        except Exception:
            logger.exception("Failed to auto-create VLESS client for tg_id=%s (admin activate)", telegram_id)

    return OkResponse(ok=True)


# ── Admin Dashboard API ──


class RefStat(BaseModel):
    source: str
    count: int


class AdminStatsResponse(BaseModel):
    total_users: int
    tg_users: int  # users with real Telegram ids (telegram_id > 0) — used for broadcast targeting
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
    tg_users = db.execute(select(func.count()).select_from(User).where(User.telegram_id > 0)).scalar() or 0
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
            Subscription.access_suspended == False,  # noqa: E712
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
        tg_users=tg_users,
        marketing_opt_out_users=marketing_opt_out_users,
        active_subscriptions=active,
        expired_subscriptions=expired,
        pending_payments=pending,
        revenue_estimate=total_paid * PAYMENT_AMOUNT_RUB,
        referrals=referrals,
    )


class SourceStat(BaseModel):
    source: str | None
    users: int
    paid: int


class FunnelStatsResponse(BaseModel):
    # --- TG funnel: unique users (telegram_id > 0) ---
    tg_users: int               # bot users total
    tg_checkout: int            # unique tg users who opened checkout (subscription row created)
    tg_payment_link: int        # unique tg users who got a payment link (lava_contract_id set)
    tg_paid: int                # unique tg users who paid (ever, incl expired)
    active_now: int             # paid + not expired + not suspended

    # 7-day cohort (same deduplicated logic)
    tg_users_7d: int
    tg_checkout_7d: int
    tg_paid_7d: int

    # --- Web users (telegram_id < 0, came via website) ---
    web_users: int
    web_paid: int

    # --- Source conversion (which channel brings buyers) ---
    source_stats: list[SourceStat]

    # --- Engagement ---
    nudge_1_sent: int
    nudge_2_sent: int
    nudge_3_sent: int
    nudge_converted: int        # users who got nudge_1 and later paid — shows nudge ROI
    opted_out: int


@app.get("/admin/funnel", response_model=FunnelStatsResponse)
def admin_funnel(req: Request, db: Session = Depends(get_db)) -> FunnelStatsResponse:
    _require_admin(req)
    now = utcnow()
    week_ago = now - timedelta(days=7)

    # ── TG users (unique real Telegram users, tg_id > 0) ──────────────────────
    tg_users = db.execute(
        select(func.count()).select_from(User).where(User.telegram_id > 0)
    ).scalar() or 0
    tg_users_7d = db.execute(
        select(func.count()).select_from(User).where(User.telegram_id > 0, User.created_at >= week_ago)
    ).scalar() or 0

    # Checkout = subscription row created; deduped by distinct telegram_id
    tg_checkout = db.execute(
        select(func.count(Subscription.telegram_id.distinct())).select_from(Subscription).where(
            Subscription.telegram_id > 0
        )
    ).scalar() or 0
    tg_checkout_7d = db.execute(
        select(func.count(Subscription.telegram_id.distinct())).select_from(Subscription).where(
            Subscription.telegram_id > 0, Subscription.created_at >= week_ago
        )
    ).scalar() or 0

    # Payment link = lava_contract_id was assigned; deduped
    tg_payment_link = db.execute(
        select(func.count(Subscription.telegram_id.distinct())).select_from(Subscription).where(
            Subscription.telegram_id > 0, Subscription.lava_contract_id.is_not(None)
        )
    ).scalar() or 0

    # Paid (ever) = paid or expired; deduped
    tg_paid = db.execute(
        select(func.count(Subscription.telegram_id.distinct())).select_from(Subscription).where(
            Subscription.telegram_id > 0, Subscription.payment_status.in_(["paid", "expired"])
        )
    ).scalar() or 0
    tg_paid_7d = db.execute(
        select(func.count(Subscription.telegram_id.distinct())).select_from(Subscription).where(
            Subscription.telegram_id > 0,
            Subscription.payment_status.in_(["paid", "expired"]),
            Subscription.created_at >= week_ago,
        )
    ).scalar() or 0

    # Active now
    active_now = db.execute(
        select(func.count()).select_from(Subscription).where(
            Subscription.payment_status == "paid",
            Subscription.expires_at.is_not(None),
            Subscription.expires_at > now,
            Subscription.access_suspended == False,  # noqa: E712
        )
    ).scalar() or 0

    # ── Web users (telegram_id < 0) ──────────────────────────────────────────
    web_users = db.execute(
        select(func.count()).select_from(User).where(User.telegram_id < 0)
    ).scalar() or 0
    web_paid = db.execute(
        select(func.count(Subscription.telegram_id.distinct())).select_from(Subscription).where(
            Subscription.telegram_id < 0, Subscription.payment_status.in_(["paid", "expired"])
        )
    ).scalar() or 0

    # ── Source conversion: users + paid per ref_source ───────────────────────
    source_user_rows = db.execute(
        select(User.ref_source, func.count().label("cnt"))
        .where(User.telegram_id > 0)
        .group_by(User.ref_source)
        .order_by(func.count().desc())
    ).all()

    # Paid by source: join User → Subscription
    source_paid_rows = db.execute(
        select(User.ref_source, func.count(User.telegram_id.distinct()).label("cnt"))
        .join(Subscription, Subscription.telegram_id == User.telegram_id)
        .where(User.telegram_id > 0, Subscription.payment_status.in_(["paid", "expired"]))
        .group_by(User.ref_source)
    ).all()
    paid_by_source: dict[str | None, int] = {r[0]: r[1] for r in source_paid_rows}

    source_stats = [
        SourceStat(source=r[0], users=r[1], paid=paid_by_source.get(r[0], 0))
        for r in source_user_rows
    ]

    # ── Engagement ───────────────────────────────────────────────────────────
    nudge_1_sent = db.execute(
        select(func.count()).select_from(User).where(User.nudge_1_sent_at.is_not(None))
    ).scalar() or 0
    nudge_2_sent = db.execute(
        select(func.count()).select_from(User).where(User.nudge_2_sent_at.is_not(None))
    ).scalar() or 0
    nudge_3_sent = db.execute(
        select(func.count()).select_from(User).where(User.nudge_3_sent_at.is_not(None))
    ).scalar() or 0

    # Nudge converted: got nudge_1 + eventually paid
    nudge_converted = db.execute(
        select(func.count(User.telegram_id.distinct()))
        .join(Subscription, Subscription.telegram_id == User.telegram_id)
        .where(
            User.nudge_1_sent_at.is_not(None),
            Subscription.payment_status.in_(["paid", "expired"]),
        )
    ).scalar() or 0

    opted_out = db.execute(
        select(func.count()).select_from(User).where(User.marketing_opt_out == True)  # noqa: E712
    ).scalar() or 0

    return FunnelStatsResponse(
        tg_users=tg_users,
        tg_checkout=tg_checkout,
        tg_payment_link=tg_payment_link,
        tg_paid=tg_paid,
        active_now=active_now,
        tg_users_7d=tg_users_7d,
        tg_checkout_7d=tg_checkout_7d,
        tg_paid_7d=tg_paid_7d,
        web_users=web_users,
        web_paid=web_paid,
        source_stats=source_stats,
        nudge_1_sent=nudge_1_sent,
        nudge_2_sent=nudge_2_sent,
        nudge_3_sent=nudge_3_sent,
        nudge_converted=nudge_converted,
        opted_out=opted_out,
    )


class CleanupWebUsersResponse(BaseModel):
    deleted_users: int
    deleted_pending_subscriptions: int
    kept_paid_subscriptions: int


@app.delete("/admin/cleanup-web-users", response_model=CleanupWebUsersResponse)
def admin_cleanup_web_users(req: Request, db: Session = Depends(get_db)) -> CleanupWebUsersResponse:
    """
    Удаляет тестовых/анонимных веб-пользователей (telegram_id < 0).
    Удаляет только pending-подписки; paid/expired сохраняются (реальные деньги).
    """
    _require_admin(req)
    web_tg_ids = db.execute(select(User.telegram_id).where(User.telegram_id < 0)).scalars().all()
    if not web_tg_ids:
        return CleanupWebUsersResponse(deleted_users=0, deleted_pending_subscriptions=0, kept_paid_subscriptions=0)

    # Count paid subs we're keeping
    kept = db.execute(
        select(func.count()).select_from(Subscription).where(
            Subscription.telegram_id.in_(web_tg_ids),
            Subscription.payment_status.in_(["paid", "expired"]),
        )
    ).scalar() or 0

    # Delete pending subscriptions only
    del_subs = db.execute(
        delete(Subscription).where(
            Subscription.telegram_id.in_(web_tg_ids),
            Subscription.payment_status == "pending",
        )
    )
    # Delete user rows
    del_users = db.execute(delete(User).where(User.telegram_id < 0))
    db.commit()

    return CleanupWebUsersResponse(
        deleted_users=del_users.rowcount,
        deleted_pending_subscriptions=del_subs.rowcount,
        kept_paid_subscriptions=kept,
    )


class SubInfo(BaseModel):
    id: int
    telegram_id: int
    username: str | None = None
    payment_status: str
    expires_at: datetime | None
    created_at: datetime
    has_proxy: bool
    access_suspended: bool = False


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
            access_suspended=bool(s.access_suspended),
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
            access_suspended=bool(s.access_suspended),
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
            access_suspended=bool(s.access_suspended),
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


# ── VPN management admin endpoints ───────────────────────────────────────────

class VpnClientInfo(BaseModel):
    id: int
    telegram_id: int
    uuid_prefix: str
    uuid: str
    active: bool
    traffic_used_gb: float
    traffic_limit_gb: int
    max_devices: int
    created_at: datetime
    last_sync_at: datetime | None


class VpnClientsResponse(BaseModel):
    clients: list[VpnClientInfo]
    total: int
    active_count: int
    total_traffic_gb: float


@app.get("/admin/vpn-clients", response_model=VpnClientsResponse)
def admin_vpn_clients(req: Request, db: Session = Depends(get_db)) -> VpnClientsResponse:
    _require_admin(req)
    clients = db.execute(
        select(VpnClient).order_by(VpnClient.created_at.desc())
    ).scalars().all()
    items = [
        VpnClientInfo(
            id=c.id,
            telegram_id=c.telegram_id,
            uuid_prefix=c.uuid[:8],
            uuid=c.uuid,
            active=c.active,
            traffic_used_gb=round(c.traffic_used_bytes / (1024 ** 3), 3),
            traffic_limit_gb=c.traffic_limit_gb,
            max_devices=c.max_devices,
            created_at=c.created_at,
            last_sync_at=c.last_sync_at,
        )
        for c in clients
    ]
    active_count = sum(1 for c in clients if c.active)
    total_traffic_gb = round(sum(c.traffic_used_bytes for c in clients) / (1024 ** 3), 3)
    return VpnClientsResponse(
        clients=items,
        total=len(items),
        active_count=active_count,
        total_traffic_gb=total_traffic_gb,
    )


@app.post("/admin/vpn-clients/{telegram_id}/deactivate", response_model=OkResponse)
def admin_vpn_client_deactivate(telegram_id: int, req: Request, db: Session = Depends(get_db)) -> OkResponse:
    _require_admin(req)
    deactivate_vpn_client(telegram_id, db)
    return OkResponse(ok=True)


@app.post("/vpn/sync-traffic", response_model=OkResponse)
def vpn_sync_traffic_manual(req: Request) -> OkResponse:
    """Manually trigger VPN traffic sync from 3X-UI (admin only)."""
    _require_admin(req)
    try:
        _process_vpn_traffic_sync()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return OkResponse(ok=True)
