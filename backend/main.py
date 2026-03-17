from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Generator, Literal
from uuid import UUID, uuid4

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db").strip()
LAVA_PAY_URL_TEMPLATE = os.getenv(
    "LAVA_PAY_URL_TEMPLATE", "https://lava.top/pay/YOUR_ID?order_id={payment_token}"
).strip()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


PaymentStatus = Literal["pending", "paid"]


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)

    proxy_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    proxy_server: Mapped[str | None] = mapped_column(String(255), nullable=True)
    proxy_port: Mapped[int | None] = mapped_column(Integer, nullable=True)

    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    payment_token: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    payment_status: Mapped[str] = mapped_column(String(16), default="pending", index=True, nullable=False)

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


app = FastAPI(title="MTProxy Backend", version="0.2.0")


@app.on_event("startup")
def _startup() -> None:
    Base.metadata.create_all(bind=engine)


class HealthResponse(BaseModel):
    status: Literal["ok"]


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


class CheckoutCreateRequest(BaseModel):
    telegram_id: int = Field(..., ge=1)
    username: str | None = Field(default=None, max_length=64)


class CheckoutCreateResponse(BaseModel):
    payment_url: str
    payment_token: UUID


@app.post("/checkout/create", response_model=CheckoutCreateResponse)
def checkout_create(payload: CheckoutCreateRequest, db: Session = Depends(get_db)) -> CheckoutCreateResponse:
    tg_id = int(payload.telegram_id)
    username = payload.username.strip() if payload.username else None

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

    payment_url = LAVA_PAY_URL_TEMPLATE.format(payment_token=str(token))
    return CheckoutCreateResponse(payment_url=payment_url, payment_token=token)


class LavaWebhookRequest(BaseModel):
    order_id: UUID
    status: str
    amount: str | float | int | None = None


class OkResponse(BaseModel):
    ok: bool = True


def activate_subscription(sub: Subscription) -> None:
    sub.payment_status = "paid"
    sub.expires_at = utcnow() + timedelta(days=30)
    sub.proxy_secret = secrets.token_hex(16)  # 32 hex chars
    sub.proxy_server = "mtproxy.example.com"
    sub.proxy_port = 443


@app.post("/webhooks/lava", response_model=OkResponse)
def lava_webhook(payload: LavaWebhookRequest, db: Session = Depends(get_db)) -> OkResponse:
    if payload.status != "success":
        return OkResponse(ok=True)

    sub = db.execute(select(Subscription).where(Subscription.payment_token == str(payload.order_id))).scalar_one_or_none()
    if sub is None:
        # Чтобы вебхук не ретраился бесконечно, отвечаем 200.
        return OkResponse(ok=True)

    activate_subscription(sub)
    db.commit()
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


class LavaTestRequest(BaseModel):
    payment_token: UUID


@app.post("/webhooks/lava/test", response_model=OkResponse)
def lava_test(payload: LavaTestRequest, db: Session = Depends(get_db)) -> OkResponse:
    sub = db.execute(select(Subscription).where(Subscription.payment_token == str(payload.payment_token))).scalar_one_or_none()
    if sub is None:
        raise HTTPException(status_code=404, detail="Subscription not found for payment_token")

    activate_subscription(sub)
    db.commit()
    return OkResponse(ok=True)

