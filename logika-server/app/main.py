from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.claude_service import analyze_session, next_clarifying_question
from app.config import Settings, get_settings
from app.db import Base, engine, get_db
from app.models import LogikaChatSession, LogikaOtpCode, LogikaUser
from app.pdf_report import build_pdf_bytes
from app.phone import normalize_ru_phone, to_e164
from app.security import create_access_token, decode_token, hash_otp, random_digits
from app.smsaero import send_otp_sms

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_settings_dep() -> Settings:
    return get_settings()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Logika API", version="0.1.0")

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _startup() -> None:
        Base.metadata.create_all(bind=engine)
        logger.info("Logika DB ready")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    class RequestCodeBody(BaseModel):
        phone: str = Field(..., min_length=10)

    class VerifyBody(BaseModel):
        phone: str
        code: str = Field(..., min_length=4, max_length=8)

    @app.post("/v1/auth/request-code")
    async def request_code(
        body: RequestCodeBody,
        db: Session = Depends(get_db),
        settings: Settings = Depends(get_settings_dep),
    ) -> dict[str, bool]:
        try:
            digits = normalize_ru_phone(body.phone)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        phone_e164 = to_e164(digits)
        code = random_digits(6)
        h = hash_otp(settings, digits, code)
        exp = datetime.now(timezone.utc) + timedelta(minutes=10)
        db.execute(delete(LogikaOtpCode).where(LogikaOtpCode.phone_e164 == phone_e164))
        db.add(LogikaOtpCode(phone_e164=phone_e164, code_hash=h, expires_at=exp))
        db.commit()
        try:
            await send_otp_sms(settings, digits, code)
        except Exception as e:
            logger.exception("SMS send failed")
            raise HTTPException(502, f"Не удалось отправить SMS: {e}") from e
        return {"ok": True}

    @app.post("/v1/auth/verify")
    def verify_code(
        body: VerifyBody,
        db: Session = Depends(get_db),
        settings: Settings = Depends(get_settings_dep),
    ) -> dict[str, str]:
        try:
            digits = normalize_ru_phone(body.phone)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        phone_e164 = to_e164(digits)
        code = body.code.strip().replace(" ", "")
        h = hash_otp(settings, digits, code)
        row = db.execute(
            select(LogikaOtpCode)
            .where(LogikaOtpCode.phone_e164 == phone_e164)
            .where(LogikaOtpCode.used.is_(False))
            .where(LogikaOtpCode.expires_at > datetime.now(timezone.utc))
        ).scalar_one_or_none()
        if row is None or row.code_hash != h:
            raise HTTPException(401, "Неверный код или срок истёк")
        row.used = True
        user = db.execute(select(LogikaUser).where(LogikaUser.phone_e164 == phone_e164)).scalar_one_or_none()
        if user is None:
            user = LogikaUser(phone_e164=phone_e164)
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            db.commit()
        token = create_access_token(settings, user.id)
        return {"access_token": token, "token_type": "bearer"}

    def get_bearer_user(
        authorization: Annotated[str | None, Header()] = None,
        db: Session = Depends(get_db),
        settings: Settings = Depends(get_settings_dep),
    ) -> LogikaUser:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(401, "Нужен Bearer-токен")
        raw = authorization.split(" ", 1)[1].strip()
        try:
            uid = decode_token(settings, raw)
        except ValueError:
            raise HTTPException(401, "Недействительный токен") from None
        user = db.get(LogikaUser, uid)
        if user is None:
            raise HTTPException(401, "Пользователь не найден")
        return user

    class StartSessionBody(BaseModel):
        dilemma: str = Field(..., min_length=8, max_length=8000)

    @app.post("/v1/sessions/start")
    async def start_session(
        body: StartSessionBody,
        db: Session = Depends(get_db),
        settings: Settings = Depends(get_settings_dep),
        user: LogikaUser = Depends(get_bearer_user),
    ) -> dict[str, str]:
        sess = LogikaChatSession(user_id=user.id, dilemma=body.dilemma.strip(), messages=[], phase="clarifying")
        db.add(sess)
        db.commit()
        db.refresh(sess)
        try:
            q1 = await next_clarifying_question(settings, sess.dilemma, [])
        except Exception as e:
            logger.exception("Claude Q1")
            db.delete(sess)
            db.commit()
            raise HTTPException(502, str(e)) from e
        sess.messages = [{"role": "assistant", "content": q1}]
        db.commit()
        return {"session_id": str(sess.id), "bot_message": q1}

    class ReplyBody(BaseModel):
        text: str = Field(..., min_length=1, max_length=8000)

    @app.post("/v1/sessions/{session_id}/reply")
    async def reply(
        session_id: uuid.UUID,
        body: ReplyBody,
        db: Session = Depends(get_db),
        settings: Settings = Depends(get_settings_dep),
        user: LogikaUser = Depends(get_bearer_user),
    ) -> dict:
        sess = db.get(LogikaChatSession, session_id)
        if sess is None or sess.user_id != user.id:
            raise HTTPException(404, "Сессия не найдена")
        if sess.phase != "clarifying":
            raise HTTPException(400, "Сессия уже закрыта")

        msgs = list(sess.messages or [])
        msgs.append({"role": "user", "content": body.text.strip()})
        n_user = len([m for m in msgs if m["role"] == "user"])

        if n_user < settings.questions_count:
            try:
                nxt = await next_clarifying_question(settings, sess.dilemma, msgs)
            except Exception as e:
                logger.exception("Claude Qn")
                raise HTTPException(502, str(e)) from e
            msgs.append({"role": "assistant", "content": nxt})
            sess.messages = msgs
            sess.updated_at = datetime.now(timezone.utc)
            db.commit()
            return {"bot_message": nxt, "done": False}

        try:
            rep = await analyze_session(settings, sess.dilemma, msgs)
        except Exception as e:
            logger.exception("Claude analyze")
            raise HTTPException(502, str(e)) from e
        sess.messages = msgs
        sess.report = rep
        sess.score = int(rep.get("overall_score", 0))
        sess.phase = "done"
        sess.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"done": True, "report": rep}

    @app.get("/v1/sessions/{session_id}/pdf")
    def get_pdf(
        session_id: uuid.UUID,
        db: Session = Depends(get_db),
        user: LogikaUser = Depends(get_bearer_user),
    ) -> Response:
        sess = db.get(LogikaChatSession, session_id)
        if sess is None or sess.user_id != user.id:
            raise HTTPException(404, "Сессия не найдена")
        if not sess.report:
            raise HTTPException(400, "Отчёт ещё не готов")
        pdf = build_pdf_bytes(sess.report, sess.dilemma)
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="logika-{session_id}.pdf"'},
        )

    return app


app = create_app()
