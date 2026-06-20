"""Daily rotating clickbait broadcasts (templates B–H) with DB analytics."""
from __future__ import annotations

import fcntl
import logging
import os
import threading
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, TextIO
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

logger = logging.getLogger("daily_broadcast")

MSK = ZoneInfo("Europe/Moscow")

DailyBroadcastRun: Any = None
DailyBroadcastDelivery: Any = None
User: Any = None
Subscription: Any = None

_daily_lock = threading.Lock()
_daily_running = False

TEMPLATE_B = "B"
TEMPLATE_C = "C"
TEMPLATE_D = "D"
TEMPLATE_E = "E"
TEMPLATE_F = "F"
TEMPLATE_G = "G"
TEMPLATE_H = "H"

TEMPLATE_KEYS: tuple[str, ...] = (
    TEMPLATE_B,
    TEMPLATE_C,
    TEMPLATE_D,
    TEMPLATE_E,
    TEMPLATE_F,
    TEMPLATE_G,
    TEMPLATE_H,
)

_SCHEDULER_LOCK_PATH = Path(
    os.getenv("DAILY_BROADCAST_LOCK_FILE", "/tmp/frosty-daily-broadcast.lock")
)


def bind_models(*, daily_broadcast_run, daily_broadcast_delivery, user, subscription) -> None:
    global DailyBroadcastRun, DailyBroadcastDelivery, User, Subscription
    DailyBroadcastRun = daily_broadcast_run
    DailyBroadcastDelivery = daily_broadcast_delivery
    User = user
    Subscription = subscription


def template_keys() -> tuple[str, ...]:
    return TEMPLATE_KEYS


def _enabled() -> bool:
    return (os.getenv("DAILY_BROADCAST_ENABLED") or "true").strip().lower() in ("1", "true", "yes", "on")


def _hour_msk() -> int:
    try:
        hour = int((os.getenv("DAILY_BROADCAST_HOUR_MSK") or "17").strip())
        return max(0, min(23, hour))
    except ValueError:
        return 17


def _button_text() -> str:
    return (os.getenv("DAILY_BROADCAST_BUTTON_TEXT") or "🔥 Зафиксировать тариф").strip()[:64]


def _templates(price_rub: int) -> dict[str, str]:
    p = int(price_rub)
    return {
        TEMPLATE_B: (
            "⚠️ <b>Instagram и YouTube уже режут по регионам</b>\n\n"
            "Завтра может стать хуже. Frosty работает с обходом глушилок — "
            f"<b>{p} ₽/мес</b>, пока не подняли цену.\n\n"
            "👇 Успейте до полного отключения"
        ),
        TEMPLATE_C: (
            "🇷🇺 <b>Последнее предупреждение на сегодня</b>\n\n"
            "Обычный VPN скоро не поможет. <b>Frosty</b> уже готов — умное шифрование и обход глушилок.\n\n"
            f"<b>3 места по старой цене</b> ({p} ₽/мес) — жми кнопку 👇"
        ),
        TEMPLATE_D: (
            "🔥 <b>Только что 3 пользователя купили Frosty</b>\n\n"
            "Пока ты читаешь — кто-то уже подключился. Старую цену "
            f"<b>{p} ₽/мес</b> могут закрыть в любой момент.\n\n"
            "👇 Зафиксируй доступ"
        ),
        TEMPLATE_E: (
            "🚨 <b>В России режут доступ к зарубежным сервисам</b>\n\n"
            "Instagram, YouTube, WhatsApp — всё под ударом. <b>Frosty</b> уже обходит глушилки.\n\n"
            f"<b>{p} ₽/мес</b> — пока не подняли. Жми 👇"
        ),
        TEMPLATE_F: (
            "⏳ <b>Осталось мало времени по старой цене</b>\n\n"
            "Frosty — умный VPN с обходом блокировок. Тариф "
            f"<b>{p} ₽/мес</b> скоро могут поднять.\n\n"
            "👇 Успей сегодня"
        ),
        TEMPLATE_G: (
            "👀 <b>Сотни людей уже перешли на Frosty</b>\n\n"
            "Обычный VPN в РФ уже не тянет. У нас — шифрование и обход глушилок.\n\n"
            f"<b>3 места</b> по <b>{p} ₽/мес</b> — жми кнопку 👇"
        ),
        TEMPLATE_H: (
            "⚡ <b>Сегодня без Frosty — завтра без Instagram</b>\n\n"
            "Блокировки усиливаются каждый день. Подключи умный VPN за "
            f"<b>{p} ₽/мес</b> — одна кнопка 👇"
        ),
    }


def _next_template_key(db) -> str:
    last = db.execute(
        select(DailyBroadcastRun.template_key)
        .where(DailyBroadcastRun.status == "done")
        .order_by(DailyBroadcastRun.id.desc())
        .limit(1)
    ).scalar_one_or_none()
    if last not in TEMPLATE_KEYS:
        return TEMPLATE_B
    idx = TEMPLATE_KEYS.index(last)
    return TEMPLATE_KEYS[(idx + 1) % len(TEMPLATE_KEYS)]


def _run_for_msk_date(db, run_date: date) -> Any | None:
    return db.execute(
        select(DailyBroadcastRun.id)
        .where(
            DailyBroadcastRun.run_date == run_date,
            DailyBroadcastRun.status.in_(("done", "running")),
        )
        .limit(1)
    ).scalar_one_or_none()


def _template_titles() -> dict[str, str]:
    return {
        TEMPLATE_B: "Instagram / YouTube режут регионы",
        TEMPLATE_C: "Последнее предупреждение на сегодня",
        TEMPLATE_D: "3 пользователя только что купили",
        TEMPLATE_E: "Режут зарубежные сервисы",
        TEMPLATE_F: "Мало времени по старой цене",
        TEMPLATE_G: "Сотни уже перешли на Frosty",
        TEMPLATE_H: "Завтра без Instagram",
    }


def template_catalog(price_rub: int) -> dict[str, Any]:
    button_text = _button_text()
    templates = _templates(price_rub)
    titles = _template_titles()
    return {
        "button_text": button_text,
        "price_rub": price_rub,
        "template_keys": list(TEMPLATE_KEYS),
        "templates": [
            {
                "key": key,
                "title": titles[key],
                "message_html": templates[key],
            }
            for key in TEMPLATE_KEYS
        ],
    }


def _recipient_ids(db) -> list[int]:
    q = select(User.telegram_id).where(User.telegram_id > 0, User.marketing_opt_out == False)  # noqa: E712
    seen: set[int] = set()
    out: list[int] = []
    for raw in db.execute(q).scalars().all():
        uid = int(raw)
        if uid not in seen:
            seen.add(uid)
            out.append(uid)
    return out


def _keyboard(delivery_id: int, button_text: str) -> dict:
    return {
        "inline_keyboard": [[{"text": button_text, "callback_data": f"dbc:{delivery_id}:buy"}]],
    }


def _acquire_scheduler_lock() -> TextIO | None:
    """Cross-process lock so only one uvicorn worker runs the daily scheduler."""
    try:
        handle = _SCHEDULER_LOCK_PATH.open("a+")
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        handle.seek(0)
        handle.write(str(os.getpid()))
        handle.truncate()
        handle.flush()
        return handle
    except BlockingIOError:
        return None
    except OSError:
        logger.exception("Daily broadcast scheduler lock failed")
        return None


def _worker(
    run_id: int,
    ids: list[int],
    message: str,
    button_text: str,
    *,
    send_tg: Callable[[int, str, dict | None], bool],
    session_factory,
) -> None:
    global _daily_running
    db = session_factory()
    try:
        run = db.get(DailyBroadcastRun, run_id)
        if run is None:
            return
        sent = failed = 0
        for uid in ids:
            delivery = DailyBroadcastDelivery(
                run_id=run_id,
                telegram_id=uid,
                delivered_ok=False,
            )
            db.add(delivery)
            db.flush()
            kb = _keyboard(delivery.id, button_text)
            ok = send_tg(uid, message, kb)
            delivery.delivered_ok = bool(ok)
            if not ok:
                delivery.error = "send_failed"
            if ok:
                sent += 1
            else:
                failed += 1
            db.commit()
            time.sleep(0.05)
        run = db.get(DailyBroadcastRun, run_id)
        if run:
            run.sent_count = sent
            run.failed_count = failed
            run.status = "test" if run.status == "test" else "done"
            run.finished_at = datetime.now(timezone.utc)
            db.commit()
        logger.info("Daily broadcast run_id=%s done sent=%s failed=%s", run_id, sent, failed)
    except Exception:
        logger.exception("Daily broadcast worker failed run_id=%s", run_id)
        try:
            run = db.get(DailyBroadcastRun, run_id)
            if run:
                run.status = "failed"
                run.finished_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
        with _daily_lock:
            _daily_running = False


def start_daily_broadcast(
    db,
    *,
    send_tg: Callable[[int, str, dict | None], bool],
    session_factory,
    price_rub: int,
    run_date: date | None = None,
    template_key: str | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Queue daily broadcast. Returns {started, run_id, template_key, total} or {skipped, reason}."""
    global _daily_running
    if not force and not _enabled():
        return {"started": False, "skipped": True, "reason": "disabled"}

    with _daily_lock:
        if _daily_running:
            return {"started": False, "skipped": True, "reason": "already_running"}

    rd = run_date or datetime.now(MSK).date()
    if not force and _run_for_msk_date(db, rd) is not None:
        return {"started": False, "skipped": True, "reason": "already_sent_today", "run_date": rd.isoformat()}

    templates = _templates(price_rub)
    key = template_key if template_key in templates else _next_template_key(db)
    message = templates[key]
    button_text = _button_text()
    ids = _recipient_ids(db)

    run = DailyBroadcastRun(
        template_key=key,
        message_html=message,
        button_text=button_text,
        run_date=rd,
        total_recipients=len(ids),
        sent_count=0,
        failed_count=0,
        click_count=0,
        conversion_count=0,
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    with _daily_lock:
        _daily_running = True

    t = threading.Thread(
        target=_worker,
        args=(run.id, ids, message, button_text),
        kwargs={"send_tg": send_tg, "session_factory": session_factory},
        daemon=True,
    )
    t.start()
    return {
        "started": True,
        "run_id": run.id,
        "template_key": key,
        "total": len(ids),
        "run_date": rd.isoformat(),
    }


def send_template_test(
    db,
    *,
    send_tg: Callable[[int, str, dict | None], bool],
    session_factory,
    price_rub: int,
    template_key: str,
    telegram_ids: list[int],
) -> dict[str, Any]:
    """Send one template to a small test audience (prod IDs). Logged as status=test."""
    global _daily_running
    templates = _templates(price_rub)
    key = template_key if template_key in templates else TEMPLATE_B
    ids = [int(x) for x in telegram_ids if int(x) > 0]
    if not ids:
        return {"started": False, "skipped": True, "reason": "no_recipients"}
    if len(ids) > 20:
        return {"started": False, "skipped": True, "reason": "too_many_recipients"}

    with _daily_lock:
        if _daily_running:
            return {"started": False, "skipped": True, "reason": "already_running"}

    message = templates[key]
    button_text = _button_text()
    run = DailyBroadcastRun(
        template_key=key,
        message_html=message,
        button_text=button_text,
        run_date=datetime.now(MSK).date(),
        total_recipients=len(ids),
        sent_count=0,
        failed_count=0,
        click_count=0,
        conversion_count=0,
        status="test",
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    with _daily_lock:
        _daily_running = True

    t = threading.Thread(
        target=_worker,
        args=(run.id, ids, message, button_text),
        kwargs={"send_tg": send_tg, "session_factory": session_factory},
        daemon=True,
    )
    t.start()
    return {
        "started": True,
        "run_id": run.id,
        "template_key": key,
        "total": len(ids),
        "test": True,
    }


def maybe_run_scheduled_daily_broadcast(
    db,
    *,
    send_tg: Callable[[int, str, dict | None], bool],
    session_factory,
    price_rub: int,
) -> dict[str, Any]:
    if not _enabled():
        return {"skipped": True, "reason": "disabled"}

    now_msk = datetime.now(MSK)
    target_hour = _hour_msk()
    if now_msk.hour < target_hour:
        return {"skipped": True, "reason": "before_hour", "hour_msk": now_msk.hour}

    lock = _acquire_scheduler_lock()
    if lock is None:
        return {"skipped": True, "reason": "scheduler_lock_held"}

    try:
        if _run_for_msk_date(db, now_msk.date()) is not None:
            return {"skipped": True, "reason": "already_sent_today", "run_date": now_msk.date().isoformat()}

        result = start_daily_broadcast(
            db,
            send_tg=send_tg,
            session_factory=session_factory,
            price_rub=price_rub,
            run_date=now_msk.date(),
        )
        if result.get("started"):
            logger.info(
                "Daily broadcast scheduled run_id=%s template=%s total=%s date=%s",
                result.get("run_id"),
                result.get("template_key"),
                result.get("total"),
                now_msk.date().isoformat(),
            )
        return result
    finally:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
            lock.close()
        except OSError:
            pass


def record_click(db, delivery_id: int) -> bool:
    delivery = db.get(DailyBroadcastDelivery, delivery_id)
    if delivery is None:
        return False
    if delivery.clicked_at is None:
        delivery.clicked_at = datetime.now(timezone.utc)
        run = db.get(DailyBroadcastRun, delivery.run_id)
        if run:
            run.click_count = (run.click_count or 0) + 1
        db.commit()
    return True


def record_conversion_for_user(db, telegram_id: int, *, paid_clause: Any) -> int:
    """Mark conversion on latest daily delivery within 7 days after paid subscription."""
    has_paid = db.execute(
        select(Subscription.id).where(Subscription.telegram_id == int(telegram_id), paid_clause).limit(1)
    ).scalar_one_or_none()
    if has_paid is None:
        return 0
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    delivery = db.execute(
        select(DailyBroadcastDelivery)
        .where(
            DailyBroadcastDelivery.telegram_id == int(telegram_id),
            DailyBroadcastDelivery.delivered_ok == True,  # noqa: E712
            DailyBroadcastDelivery.sent_at >= cutoff,
            DailyBroadcastDelivery.converted_at.is_(None),
        )
        .order_by(DailyBroadcastDelivery.sent_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    if delivery is None:
        return 0
    delivery.converted_at = datetime.now(timezone.utc)
    run = db.get(DailyBroadcastRun, delivery.run_id)
    if run:
        run.conversion_count = (run.conversion_count or 0) + 1
    db.commit()
    return 1


def list_runs(db, *, limit: int = 60) -> list[dict[str, Any]]:
    runs = db.execute(
        select(DailyBroadcastRun).order_by(DailyBroadcastRun.id.desc()).limit(limit)
    ).scalars().all()
    out: list[dict[str, Any]] = []
    for r in runs:
        clicks_db = db.execute(
            select(func.count())
            .select_from(DailyBroadcastDelivery)
            .where(
                DailyBroadcastDelivery.run_id == r.id,
                DailyBroadcastDelivery.clicked_at.is_not(None),
            )
        ).scalar() or 0
        conv_db = db.execute(
            select(func.count())
            .select_from(DailyBroadcastDelivery)
            .where(
                DailyBroadcastDelivery.run_id == r.id,
                DailyBroadcastDelivery.converted_at.is_not(None),
            )
        ).scalar() or 0
        sent = int(r.sent_count or 0)
        out.append(
            {
                "id": r.id,
                "run_date": r.run_date.isoformat() if r.run_date else None,
                "template_key": r.template_key,
                "status": r.status,
                "total_recipients": r.total_recipients,
                "sent": sent,
                "failed": int(r.failed_count or 0),
                "clicks": int(clicks_db),
                "conversions": int(conv_db),
                "click_rate_pct": round(100.0 * clicks_db / sent, 2) if sent else 0.0,
                "conversion_rate_pct": round(100.0 * conv_db / sent, 2) if sent else 0.0,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                "message_preview": (r.message_html or "")[:120],
            }
        )
    return out
