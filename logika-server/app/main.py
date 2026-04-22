from __future__ import annotations

import asyncio
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.claude_service import analyze_session, next_clarifying_question
from app.config import Settings, get_settings
from app.db import Base, SessionLocal, engine, get_db
from app.email_util import normalize_email
from app.mail_smtp import send_otp_email
from app.models import LogikaChatSession, LogikaOtpCode, LogikaUser
from app.pdf_report import build_pdf_bytes
from app.phone import normalize_ru_phone, to_e164
from app.schema_migrate import run_schema_migrations
from app.security import create_access_token, decode_token, hash_otp, random_digits
from app.smsaero import send_otp_sms

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _bg_send_sms(phone_e164: str, digits: str, code: str) -> None:
    """Отправка SMS после ответа HTTP — ускоряет переход к вводу кода (задержка доставки — у оператора)."""
    s = get_settings()
    try:
        await send_otp_sms(s, digits, code)
    except Exception:
        logger.exception("SMS Aero: ошибка после быстрого ответа API; OTP аннулирован")
        with SessionLocal() as db2:
            db2.execute(delete(LogikaOtpCode).where(LogikaOtpCode.phone_e164 == phone_e164))
            db2.commit()


# Браузер блокирует ответ без Access-Control-Allow-Origin → на фронте «Failed to fetch».
# Явный список в CORS_ORIGINS обязателен для своего домена; превью/деплои Vercel покрываем regex.
_VERCEL_PREVIEW_ORIGIN_RE = r"^https://[^\s/]+\.vercel\.app$"


class RequestCodeBody(BaseModel):
    phone: str = Field(..., min_length=10)


class RequestEmailCodeBody(BaseModel):
    email: str = Field(..., min_length=5, max_length=320)


class VerifyBody(BaseModel):
    phone: str | None = None
    email: str | None = None
    code: str = Field(..., min_length=4, max_length=8)

    @model_validator(mode="after")
    def _one_channel(self) -> VerifyBody:
        p = (self.phone or "").strip()
        e = (self.email or "").strip()
        if bool(p) == bool(e):
            raise ValueError("Укажите ровно одно поле: phone или email")
        return self


class StartSessionBody(BaseModel):
    dilemma: str = Field(..., min_length=8, max_length=8000)


class ReplyBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=8000)


def get_settings_dep() -> Settings:
    return get_settings()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Logika API", version="0.1.0")

    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["http://localhost:5173"],
        allow_origin_regex=_VERCEL_PREVIEW_ORIGIN_RE,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _startup() -> None:
        Base.metadata.create_all(bind=engine)
        run_schema_migrations(engine)
        logger.info("Logika DB ready")
        s = get_settings()
        sms_ok = bool(s.smsaero_email and s.smsaero_api_key)
        logger.info(
            "SMS Aero: configured=%s test_mode=%s allow_log_only=%s timeout_s=%s",
            sms_ok,
            s.smsaero_test_mode,
            s.smsaero_allow_log_only,
            s.smsaero_http_timeout_seconds,
        )
        smtp_ok = bool(s.smtp_host and (s.smtp_from or s.smtp_user))
        logger.info(
            "SMTP: configured=%s email_log_only=%s tls=%s ssl=%s",
            smtp_ok,
            s.email_allow_log_only,
            s.smtp_use_tls,
            s.smtp_use_ssl,
        )
        logger.info(
            "Anthropic: configured=%s demo_without_key=%s",
            bool(s.anthropic_api_key),
            s.anthropic_allow_demo_without_key,
        )
        logger.info(
            "LLM perf: fast_analysis=%s effective_router=%s effective_self_critique=%s questions_model=%s",
            s.fast_analysis,
            s.enable_router and not s.fast_analysis,
            s.enable_self_critique and not s.fast_analysis,
            s.anthropic_model_questions,
        )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/v1/auth/request-code")
    async def request_code(
        payload: RequestCodeBody,
        background_tasks: BackgroundTasks,
        db: Session = Depends(get_db),
        settings: Settings = Depends(get_settings_dep),
    ) -> dict[str, bool]:
        try:
            digits = normalize_ru_phone(payload.phone)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        phone_e164 = to_e164(digits)
        code = random_digits(6)
        subj = f"p:{digits}"
        h = hash_otp(settings, subj, code)
        exp = datetime.now(timezone.utc) + timedelta(minutes=10)
        db.execute(delete(LogikaOtpCode).where(LogikaOtpCode.phone_e164 == phone_e164))
        db.add(
            LogikaOtpCode(
                phone_e164=phone_e164,
                email_norm=None,
                code_hash=h,
                expires_at=exp,
            )
        )
        db.commit()
        background_tasks.add_task(_bg_send_sms, phone_e164, digits, code)
        return {"ok": True}

    @app.post("/v1/auth/request-email-code")
    async def request_email_code(
        payload: RequestEmailCodeBody,
        db: Session = Depends(get_db),
        settings: Settings = Depends(get_settings_dep),
    ) -> dict[str, bool]:
        try:
            email_norm = normalize_email(payload.email)
        except ValueError as e:
            raise HTTPException(400, str(e)) from e
        code = random_digits(6)
        subj = f"e:{email_norm}"
        h = hash_otp(settings, subj, code)
        exp = datetime.now(timezone.utc) + timedelta(minutes=10)
        db.execute(delete(LogikaOtpCode).where(LogikaOtpCode.email_norm == email_norm))
        db.add(
            LogikaOtpCode(
                phone_e164=None,
                email_norm=email_norm,
                code_hash=h,
                expires_at=exp,
            )
        )
        db.commit()
        # Для email важнее надёжность, чем "мгновенный ok":
        # отправляем сразу и возвращаем ошибку клиенту, если SMTP не сработал.
        try:
            await asyncio.to_thread(send_otp_email, settings, email_norm, code)
        except Exception as e:
            logger.exception("SMTP: request-email-code failed; OTP revoked")
            db.execute(delete(LogikaOtpCode).where(LogikaOtpCode.email_norm == email_norm))
            db.commit()
            raise HTTPException(
                502,
                "Не удалось отправить код на email. Проверьте SMTP-настройки и адрес почты.",
            ) from e
        return {"ok": True}

    @app.post("/v1/auth/verify")
    def verify_code(
        payload: VerifyBody,
        db: Session = Depends(get_db),
        settings: Settings = Depends(get_settings_dep),
    ) -> dict[str, str]:
        raw_phone = (payload.phone or "").strip()
        raw_email = (payload.email or "").strip()
        code = payload.code.strip().replace(" ", "")

        if raw_phone:
            try:
                digits = normalize_ru_phone(raw_phone)
            except ValueError as e:
                raise HTTPException(400, str(e)) from e
            phone_e164 = to_e164(digits)
            subj = f"p:{digits}"
            h = hash_otp(settings, subj, code)
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
                user = LogikaUser(phone_e164=phone_e164, email_norm=None)
                db.add(user)
                db.commit()
                db.refresh(user)
            else:
                db.commit()
        else:
            try:
                email_norm = normalize_email(raw_email)
            except ValueError as e:
                raise HTTPException(400, str(e)) from e
            subj = f"e:{email_norm}"
            h = hash_otp(settings, subj, code)
            row = db.execute(
                select(LogikaOtpCode)
                .where(LogikaOtpCode.email_norm == email_norm)
                .where(LogikaOtpCode.used.is_(False))
                .where(LogikaOtpCode.expires_at > datetime.now(timezone.utc))
            ).scalar_one_or_none()
            if row is None or row.code_hash != h:
                raise HTTPException(401, "Неверный код или срок истёк")
            row.used = True
            user = db.execute(select(LogikaUser).where(LogikaUser.email_norm == email_norm)).scalar_one_or_none()
            if user is None:
                user = LogikaUser(phone_e164=None, email_norm=email_norm)
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

    @app.post("/v1/sessions/start")
    async def start_session(
        payload: StartSessionBody,
        db: Session = Depends(get_db),
        settings: Settings = Depends(get_settings_dep),
        user: LogikaUser = Depends(get_bearer_user),
    ) -> dict[str, str]:
        sess = LogikaChatSession(user_id=user.id, dilemma=payload.dilemma.strip(), messages=[], phase="clarifying")
        db.add(sess)
        db.commit()
        db.refresh(sess)
        try:
            q1 = await next_clarifying_question(
                settings,
                sess.dilemma,
                [],
                clarify_index=1,
                clarify_total=settings.questions_count,
            )
        except Exception as e:
            logger.exception("Claude Q1")
            db.delete(sess)
            db.commit()
            raise HTTPException(502, str(e)) from e
        sess.messages = [{"role": "assistant", "content": q1}]
        db.commit()
        return {"session_id": str(sess.id), "bot_message": q1}

    @app.post("/v1/sessions/{session_id}/reply")
    async def reply(
        session_id: uuid.UUID,
        payload: ReplyBody,
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
        msgs.append({"role": "user", "content": payload.text.strip()})
        n_user = len([m for m in msgs if m["role"] == "user"])

        if n_user < settings.questions_count:
            try:
                nxt = await next_clarifying_question(
                    settings,
                    sess.dilemma,
                    msgs,
                    clarify_index=n_user + 1,
                    clarify_total=settings.questions_count,
                )
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

    @app.get("/v1/sessions/{session_id}")
    def get_session(
        session_id: uuid.UUID,
        db: Session = Depends(get_db),
        user: LogikaUser = Depends(get_bearer_user),
    ) -> dict[str, Any]:
        """Полная сессия для восстановления UI после перезагрузки (черновик чата или отчёт)."""
        sess = db.get(LogikaChatSession, session_id)
        if sess is None or sess.user_id != user.id:
            raise HTTPException(404, "Сессия не найдена")
        return {
            "session_id": str(sess.id),
            "dilemma": sess.dilemma,
            "messages": sess.messages or [],
            "phase": sess.phase,
            "report": sess.report,
            "score": sess.score,
            "created_at": sess.created_at.isoformat() if sess.created_at else None,
            "updated_at": sess.updated_at.isoformat() if sess.updated_at else None,
        }

    @app.get("/v1/me")
    def get_me(user: LogikaUser = Depends(get_bearer_user)) -> dict[str, str | None]:
        return {
            "phone_e164": user.phone_e164,
            "email_norm": user.email_norm,
            "name": user.name,
        }

    @app.get("/v1/cabinet")
    def get_cabinet(
        db: Session = Depends(get_db),
        user: LogikaUser = Depends(get_bearer_user),
    ) -> dict[str, Any]:
        """Список сессий пользователя + агрегаты для кабинета (графики, топ искажений)."""
        rows = list(
            db.execute(
                select(LogikaChatSession)
                .where(LogikaChatSession.user_id == user.id)
                .order_by(LogikaChatSession.updated_at.desc())
            )
            .scalars()
            .all()
        )
        sessions_out: list[dict[str, Any]] = []
        for sess in rows:
            verdict = None
            if sess.report and isinstance(sess.report, dict):
                verdict = sess.report.get("verdict_short")
            sessions_out.append(
                {
                    "session_id": str(sess.id),
                    "dilemma": sess.dilemma,
                    "phase": sess.phase,
                    "score": sess.score,
                    "created_at": sess.created_at.isoformat() if sess.created_at else None,
                    "updated_at": sess.updated_at.isoformat() if sess.updated_at else None,
                    "verdict_short": verdict,
                }
            )

        done = [s for s in rows if s.phase == "done" and s.score is not None]
        month_scores: dict[str, list[int]] = defaultdict(list)
        bias_counts: dict[str, int] = defaultdict(int)
        for s in done:
            if s.updated_at:
                ym = s.updated_at.strftime("%Y-%m")
                month_scores[ym].append(int(s.score or 0))
            rep = s.report if isinstance(s.report, dict) else {}
            for b in rep.get("biases") or []:
                if isinstance(b, dict):
                    nm = str(b.get("name") or "").strip()
                    if nm:
                        bias_counts[nm] += 1

        _mr = (
            "",
            "Янв",
            "Фев",
            "Мар",
            "Апр",
            "Май",
            "Июн",
            "Июл",
            "Авг",
            "Сен",
            "Окт",
            "Ноя",
            "Дек",
        )

        def _month_label(ym: str) -> str:
            y, m = ym.split("-")
            mi = int(m, 10)
            return f"{_mr[mi]} {y[2:]}"

        sorted_months = sorted(month_scores.keys(), reverse=True)[:8]
        monthly: list[dict[str, Any]] = []
        for ym in reversed(sorted_months):
            vals = month_scores[ym]
            monthly.append(
                {
                    "month": ym,
                    "label": _month_label(ym),
                    "avg_score": round(sum(vals) / len(vals)),
                    "count": len(vals),
                }
            )

        top_biases = sorted(bias_counts.items(), key=lambda x: -x[1])[:12]
        best = max(done, key=lambda x: int(x.score or 0)) if done else None
        worst = min(done, key=lambda x: int(x.score or 0)) if done else None

        def _sess_card(s: LogikaChatSession | None) -> dict[str, Any] | None:
            if s is None:
                return None
            v = None
            if s.report and isinstance(s.report, dict):
                v = s.report.get("verdict_short")
            return {
                "session_id": str(s.id),
                "score": s.score,
                "verdict_short": v,
                "dilemma_short": (s.dilemma[:120] + "…") if len(s.dilemma) > 120 else s.dilemma,
            }

        return {
            "sessions": sessions_out,
            "stats": {
                "monthly": monthly,
                "biases": [{"name": n, "count": c} for n, c in top_biases],
                "highlight_high": _sess_card(best),
                "highlight_low": _sess_card(worst),
                "totals": {
                    "sessions": len(rows),
                    "completed": len(done),
                },
            },
        }

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
        try:
            pdf = build_pdf_bytes(
                sess.report,
                sess.dilemma,
                document_date=sess.updated_at or sess.created_at,
            )
        except Exception as e:
            logger.exception("PDF generation failed")
            raise HTTPException(
                status_code=502,
                detail=f"Не удалось сгенерировать PDF: {e!s}"[:1200],
            ) from e
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="logika-{session_id}.pdf"'},
        )

    return app


app = create_app()
