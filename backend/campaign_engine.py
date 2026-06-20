"""Marketing campaigns: drip/push/lifecycle, A/B variants, AI copy, delivery stats."""
from __future__ import annotations

import hashlib
import html
import json
import logging
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.orm import Session

logger = logging.getLogger("vpn")

# Populated by main.py after models are defined
MarketingCampaign: Any = None
CampaignVariant: Any = None
CampaignDelivery: Any = None
CampaignEvent: Any = None
User: Any = None
Subscription: Any = None

CAMPAIGN_KIND_DRIP = "drip"
CAMPAIGN_KIND_PUSH = "push"
CAMPAIGN_KIND_LIFECYCLE = "lifecycle"

CAMPAIGN_STATUS_DRAFT = "draft"
CAMPAIGN_STATUS_ACTIVE = "active"
CAMPAIGN_STATUS_PAUSED = "paused"
CAMPAIGN_STATUS_ARCHIVED = "archived"

AUDIENCE_NON_PAYER = "non_payer"
AUDIENCE_TRIAL_ENDED = "trial_ended"
AUDIENCE_EXPIRING_SOON = "expiring_soon"
AUDIENCE_EXPIRED = "expired"
AUDIENCE_RENEWAL_FAILED = "renewal_failed"
AUDIENCE_BROADCAST = "broadcast_all"

ANCHOR_USER_CREATED = "user_created"
ANCHOR_TRIAL_ENDS = "trial_ends"
ANCHOR_SUBSCRIPTION_EXPIRES = "subscription_expires"

EVENT_CLICK = "click"
EVENT_CONVERTED = "converted_paid"
EVENT_OPT_OUT = "opt_out"

CTA_MINIAPP = "miniapp"
CTA_BUY_CALLBACK = "buy_callback"
CTA_NONE = "none"


def bind_models(
    *,
    marketing_campaign: Any,
    campaign_variant: Any,
    campaign_delivery: Any,
    campaign_event: Any,
    user: Any,
    subscription: Any,
) -> None:
    global MarketingCampaign, CampaignVariant, CampaignDelivery, CampaignEvent, User, Subscription
    MarketingCampaign = marketing_campaign
    CampaignVariant = campaign_variant
    CampaignDelivery = campaign_delivery
    CampaignEvent = campaign_event
    User = user
    Subscription = subscription


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _stable_variant(variants: list[Any], telegram_id: int, campaign_id: int) -> Any:
    if not variants:
        raise ValueError("no variants")
    total = sum(max(1, int(v.weight or 1)) for v in variants)
    bucket = int(hashlib.sha256(f"{telegram_id}:{campaign_id}".encode()).hexdigest()[:8], 16) % total
    acc = 0
    for v in variants:
        acc += max(1, int(v.weight or 1))
        if bucket < acc:
            return v
    return variants[-1]


def _render_placeholders(text: str, user: Any, *, price_rub: int) -> str:
    g = html.escape(user.first_name or (f"@{user.username}" if user.username else "Привет"))
    ref = ""
    if user.ref_source:
        ref = f"\n\nТы заходил по метке <code>{html.escape(str(user.ref_source))}</code>."
    out = (
        text.replace("{greeting}", g)
        .replace("{price}", str(price_rub))
        .replace("{ref_line}", ref)
    )
    return out


def _campaign_keyboard(
    campaign: Any,
    delivery_id: int,
    tg_id: int,
    *,
    miniapp_url_fn: Callable[[int], str],
) -> dict[str, Any] | None:
    cta = (campaign.cta_type or CTA_MINIAPP).strip()
    if cta == CTA_NONE:
        return None
    if cta == CTA_BUY_CALLBACK:
        return {
            "inline_keyboard": [
                [{"text": campaign.cta_label or "💳 Оформить подписку", "callback_data": "menu:buy_in_bot"}],
            ]
        }
    url = miniapp_url_fn(tg_id)
    if not url:
        return None
    label = campaign.cta_label or "💳 Оформить подписку"
    return {
        "inline_keyboard": [
            [
                {
                    "text": label,
                    "web_app": {"url": url},
                },
                {
                    "text": "📊",
                    "callback_data": f"camp:clk:{delivery_id}",
                },
            ],
        ]
    }


def _resolve_openrouter_key() -> str:
    """Inference key: env, then bot cache file (management keys return 401 on /chat/completions)."""
    cache_candidates = [
        (os.getenv("OPENROUTER_INFERENCE_CACHE") or "").strip(),
        "/opt/frostyvpn/bot/.openrouter_inference_key",
        str(Path(__file__).resolve().parent.parent / "bot" / ".openrouter_inference_key"),
    ]
    for raw in cache_candidates:
        if not raw:
            continue
        p = Path(raw)
        if p.is_file():
            cached = p.read_text(encoding="utf-8").strip()
            if cached:
                return cached
    return (os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip()


def openrouter_configured() -> bool:
    return bool(_resolve_openrouter_key())


def _llm_generate_variants(
    *,
    prompt: str,
    count: int,
    price_rub: int,
) -> list[str]:
    api_key = _resolve_openrouter_key()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY не задан — автогенерация недоступна")
    base = (os.getenv("OPENAI_BASE_URL") or "https://openrouter.ai/api/v1").rstrip("/")
    model = (os.getenv("CAMPAIGN_AI_MODEL") or os.getenv("SUPPORT_AI_MODEL") or "openrouter/free").strip()
    referer = (os.getenv("OPENROUTER_HTTP_REFERER") or os.getenv("FRONTEND_URL") or "https://frostybot.ru").strip()
    system = (
        "Ты копирайтер Telegram-бота Frosty (VPN за {price} ₽/мес). "
        "Пиши короткие продающие сообщения на русском в HTML: <b>, <i>, без markdown. "
        "Используй плейсхолдеры {greeting} и {price}. Опционально {ref_line}. "
        "В конце — мягкая отписка: <i>/stop — больше не пришлём</i>. "
        "Верни JSON-массив строк (только JSON, без пояснений)."
    ).replace("{price}", str(price_rub))
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": f"{prompt}\n\nНужно ровно {count} разных варианта."},
        ],
        "temperature": 0.85,
        "max_tokens": 1800,
    }
    req = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": referer,
            "X-Title": "Frosty Campaigns",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:300] if e.fp else ""
        raise RuntimeError(f"OpenRouter HTTP {e.code}: {body or e.reason}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"OpenRouter недоступен: {e.reason}") from e
    content = (((data.get("choices") or [{}])[0]).get("message") or {}).get("content") or ""
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    parsed = json.loads(content)
    if not isinstance(parsed, list):
        raise RuntimeError("LLM вернул не массив")
    texts = [str(x).strip() for x in parsed if str(x).strip()]
    if len(texts) < 1:
        raise RuntimeError("LLM вернул пустой список")
    return texts[:count]


def generate_campaign_variants(
    db: Session,
    campaign_id: int,
    *,
    count: int = 2,
    prompt: str | None = None,
    price_rub: int,
    replace_existing: bool = False,
) -> list[Any]:
    camp = db.get(MarketingCampaign, campaign_id)
    if camp is None:
        raise ValueError("campaign not found")
    user_prompt = (prompt or camp.ai_prompt or camp.name or "Напоминание о подписке Frosty").strip()
    texts = _llm_generate_variants(prompt=user_prompt, count=count, price_rub=price_rub)
    if replace_existing:
        db.execute(delete(CampaignVariant).where(CampaignVariant.campaign_id == campaign_id))
    existing = db.execute(
        select(CampaignVariant).where(CampaignVariant.campaign_id == campaign_id)
    ).scalars().all()
    keys = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    start = len(existing)
    created: list[Any] = []
    for i, text in enumerate(texts):
        key = keys[(start + i) % len(keys)]
        v = CampaignVariant(
            campaign_id=campaign_id,
            variant_key=key,
            weight=50,
            message_html=text[:4000],
            is_ai_generated=True,
        )
        db.add(v)
        created.append(v)
    camp.ai_prompt = user_prompt[:2000]
    camp.updated_at = _utcnow()
    db.commit()
    for v in created:
        db.refresh(v)
    return created


def record_campaign_event(db: Session, delivery_id: int, event_type: str, *, meta: dict | None = None) -> None:
    delivery = db.get(CampaignDelivery, delivery_id)
    if delivery is None:
        return
    exists = db.execute(
        select(CampaignEvent.id).where(
            CampaignEvent.delivery_id == delivery_id,
            CampaignEvent.event_type == event_type,
        ).limit(1)
    ).scalar_one_or_none()
    if exists is not None:
        return
    db.add(
        CampaignEvent(
            delivery_id=delivery_id,
            event_type=event_type,
            meta_json=json.dumps(meta or {}, ensure_ascii=False)[:2000],
        )
    )
    db.commit()


def record_conversion_for_user(
    db: Session,
    telegram_id: int,
    *,
    paid_clause: Any,
) -> int:
    """После успешной оплаты — конверсия для доставок за последние 14 дней."""
    now = _utcnow()
    cutoff = now - timedelta(days=14)
    has_paid = db.execute(
        select(Subscription.id).where(Subscription.telegram_id == int(telegram_id), paid_clause).limit(1)
    ).scalar_one_or_none()
    if has_paid is None:
        return 0
    deliveries = db.execute(
        select(CampaignDelivery)
        .where(
            CampaignDelivery.telegram_id == int(telegram_id),
            CampaignDelivery.delivered_ok == True,  # noqa: E712
            CampaignDelivery.sent_at >= cutoff,
        )
        .order_by(CampaignDelivery.sent_at.desc())
    ).scalars().all()
    n = 0
    for d in deliveries:
        before = db.execute(
            select(CampaignEvent.id)
            .where(
                CampaignEvent.delivery_id == d.id,
                CampaignEvent.event_type == EVENT_CONVERTED,
            )
            .limit(1)
        ).scalar_one_or_none()
        if before is not None:
            continue
        db.add(
            CampaignEvent(
                delivery_id=d.id,
                event_type=EVENT_CONVERTED,
                meta_json=json.dumps({"telegram_id": telegram_id}, ensure_ascii=False),
            )
        )
        n += 1
    if n:
        db.commit()
    return n


def campaign_stats(db: Session, campaign_id: int) -> dict[str, Any]:
    camp = db.get(MarketingCampaign, campaign_id)
    if camp is None:
        raise ValueError("campaign not found")
    variants = db.execute(
        select(CampaignVariant).where(CampaignVariant.campaign_id == campaign_id)
    ).scalars().all()
    rows: list[dict[str, Any]] = []
    for v in variants:
        sent = db.execute(
            select(func.count())
            .select_from(CampaignDelivery)
            .where(CampaignDelivery.variant_id == v.id, CampaignDelivery.delivered_ok == True)  # noqa: E712
        ).scalar() or 0
        clicks = db.execute(
            select(func.count())
            .select_from(CampaignEvent)
            .join(CampaignDelivery, CampaignEvent.delivery_id == CampaignDelivery.id)
            .where(CampaignDelivery.variant_id == v.id, CampaignEvent.event_type == EVENT_CLICK)
        ).scalar() or 0
        converted = db.execute(
            select(func.count())
            .select_from(CampaignEvent)
            .join(CampaignDelivery, CampaignEvent.delivery_id == CampaignDelivery.id)
            .where(CampaignDelivery.variant_id == v.id, CampaignEvent.event_type == EVENT_CONVERTED)
        ).scalar() or 0
        rows.append(
            {
                "variant_id": v.id,
                "variant_key": v.variant_key,
                "weight": v.weight,
                "is_ai_generated": bool(v.is_ai_generated),
                "sent": int(sent),
                "clicks": int(clicks),
                "converted": int(converted),
                "ctr_pct": round(100.0 * clicks / sent, 2) if sent else 0.0,
                "conversion_pct": round(100.0 * converted / sent, 2) if sent else 0.0,
                "message_preview": (v.message_html or "")[:120],
            }
        )
    total_sent = sum(r["sent"] for r in rows)
    return {
        "campaign_id": campaign_id,
        "slug": camp.slug,
        "name": camp.name,
        "status": camp.status,
        "kind": camp.kind,
        "total_sent": total_sent,
        "variants": rows,
    }


def _paid_tg_ids(db: Session, paid_clause: Any) -> set[int]:
    rows = db.execute(
        select(Subscription.telegram_id).where(paid_clause).distinct()
    ).scalars().all()
    return {int(x) for x in rows}


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _trial_end_at(user: Any, trial_by_user: dict[int, Any], now: datetime, trial_days: int) -> datetime | None:
    if user.trial_consumed_at is None:
        return None
    sub = trial_by_user.get(int(user.telegram_id))
    if sub and sub.expires_at:
        return _as_utc(sub.expires_at)
    return _as_utc(user.trial_consumed_at + timedelta(days=trial_days))


def _trigger_due(
    campaign: Any,
    user: Any,
    *,
    now: datetime,
    trial_by_user: dict[int, Any],
    trial_days: int,
) -> bool:
    offset = timedelta(minutes=int(campaign.trigger_offset_minutes or 0))
    anchor = (campaign.trigger_anchor or ANCHOR_USER_CREATED).strip()
    if anchor == ANCHOR_USER_CREATED:
        return _as_utc(user.created_at) + offset <= now
    if anchor == ANCHOR_TRIAL_ENDS:
        end = _trial_end_at(user, trial_by_user, now, trial_days)
        return bool(end and end + offset <= now)
    return False


def _legacy_nudge_already_sent(user: Any, slug: str) -> bool:
    """Не дублировать старые nudge_*_sent_at после миграции на кампании."""
    mapping = {
        "sales_nudge_1": "nudge_1_sent_at",
        "sales_nudge_2": "nudge_2_sent_at",
        "sales_nudge_3": "nudge_3_sent_at",
        "trial_followup_1": "trial_nudge_1_sent_at",
        "trial_followup_2": "trial_nudge_2_sent_at",
        "trial_followup_3": "trial_nudge_3_sent_at",
    }
    col = mapping.get(slug)
    if not col:
        return False
    return getattr(user, col, None) is not None


def process_campaigns(
    db: Session,
    *,
    send_tg: Callable[[int, str, dict | None], bool],
    miniapp_url_fn: Callable[[int], str],
    paid_clause: Any,
    real_paid_clause: Any,
    price_rub: int,
    trial_days: int,
    bot_token: str,
    frontend_url: str,
) -> int:
    if not bot_token or not frontend_url:
        return 0
    now = _utcnow()
    paid_set = _paid_tg_ids(db, real_paid_clause)
    campaigns = db.execute(
        select(MarketingCampaign).where(
            MarketingCampaign.status == CAMPAIGN_STATUS_ACTIVE,
            MarketingCampaign.kind.in_([CAMPAIGN_KIND_DRIP, CAMPAIGN_KIND_LIFECYCLE]),
        )
    ).scalars().all()
    if not campaigns:
        return 0

    trial_rows = db.execute(
        select(Subscription).where(
            Subscription.telegram_id > 0,
            Subscription.is_trial_offer == True,  # noqa: E712
            Subscription.expires_at.is_not(None),
        )
    ).scalars().all()
    trial_by_user: dict[int, Any] = {}
    for sub in trial_rows:
        tg = int(sub.telegram_id)
        prev = trial_by_user.get(tg)
        if prev is None or ((sub.expires_at or now) > (prev.expires_at or now)):
            trial_by_user[tg] = sub

    users = db.execute(
        select(User).where(User.telegram_id > 0, User.marketing_opt_out == False)  # noqa: E712
    ).scalars().all()

    sent_count = 0
    for camp in campaigns:
        variants = db.execute(
            select(CampaignVariant).where(CampaignVariant.campaign_id == camp.id)
        ).scalars().all()
        if not variants:
            continue
        audience = (camp.audience or AUDIENCE_NON_PAYER).strip()
        for user in users:
            tg = int(user.telegram_id)
            if tg in paid_set and audience in (AUDIENCE_NON_PAYER, AUDIENCE_TRIAL_ENDED):
                continue
            if audience == AUDIENCE_TRIAL_ENDED:
                if user.trial_consumed_at is None:
                    continue
                end = _trial_end_at(user, trial_by_user, now, trial_days)
                if not end or end > now:
                    continue
            elif audience == AUDIENCE_NON_PAYER:
                if user.trial_consumed_at is not None:
                    end = _trial_end_at(user, trial_by_user, now, trial_days)
                    if end and end <= now:
                        continue
            elif audience == AUDIENCE_EXPIRING_SOON:
                continue
            else:
                continue

            already = db.execute(
                select(CampaignDelivery.id)
                .where(
                    CampaignDelivery.campaign_id == camp.id,
                    CampaignDelivery.telegram_id == tg,
                )
                .limit(1)
            ).scalar_one_or_none()
            if already is not None:
                continue
            if _legacy_nudge_already_sent(user, camp.slug):
                continue
            if not _trigger_due(camp, user, now=now, trial_by_user=trial_by_user, trial_days=trial_days):
                continue

            variant = _stable_variant(variants, tg, camp.id)
            text = _render_placeholders(variant.message_html, user, price_rub=price_rub)
            delivery = CampaignDelivery(
                campaign_id=camp.id,
                variant_id=variant.id,
                telegram_id=tg,
                sent_at=now,
                delivered_ok=False,
            )
            db.add(delivery)
            db.flush()
            kb = _campaign_keyboard(camp, delivery.id, tg, miniapp_url_fn=miniapp_url_fn)
            ok = send_tg(tg, text, kb)
            delivery.delivered_ok = bool(ok)
            if not ok:
                delivery.error = "send_failed"
            sent_count += 1
            logger.info(
                "Campaign sent slug=%s tg=%s variant=%s ok=%s",
                camp.slug,
                tg,
                variant.variant_key,
                ok,
            )
    db.commit()
    return sent_count


def seed_default_campaigns(db: Session, *, price_rub: int) -> int:
    """Idempotent seed: sales + trial drip campaigns with A/B placeholders."""
    defaults = [
        {
            "slug": "sales_nudge_1",
            "name": "Sales nudge #1 (+2ч)",
            "kind": CAMPAIGN_KIND_DRIP,
            "audience": AUDIENCE_NON_PAYER,
            "anchor": ANCHOR_USER_CREATED,
            "offset_min": 120,
            "variants": [
                (
                    "A",
                    "{greeting}, коротко напомню: <b>Frosty</b> — VPN за <b>{price} ₽/мес</b>.{ref_line}\n\n<i>/stop</i>",
                ),
                (
                    "B",
                    "{greeting}, Telegram без VPN: <b>Frosty</b> ускоряет мессенджер и даёт VPN для соцсетей — <b>{price} ₽/мес</b>.{ref_line}\n\n<i>/stop</i>",
                ),
            ],
        },
        {
            "slug": "sales_nudge_2",
            "name": "Sales nudge #2 (+24ч)",
            "kind": CAMPAIGN_KIND_DRIP,
            "audience": AUDIENCE_NON_PAYER,
            "anchor": ANCHOR_USER_CREATED,
            "offset_min": 1440,
            "variants": [
                (
                    "A",
                    "{greeting}, в Frosty и Telegram, и Instagram через один VPN — <b>{price} ₽/мес</b>.{ref_line}\n\n<i>/stop</i>",
                ),
                (
                    "B",
                    "{greeting}, один раз настроил — работают Telegram и TikTok. <b>{price} ₽/мес</b>.{ref_line}\n\n<i>/stop</i>",
                ),
            ],
        },
        {
            "slug": "sales_nudge_3",
            "name": "Sales nudge #3 (+72ч)",
            "kind": CAMPAIGN_KIND_DRIP,
            "audience": AUDIENCE_NON_PAYER,
            "anchor": ANCHOR_USER_CREATED,
            "offset_min": 4320,
            "variants": [
                (
                    "A",
                    "{greeting}, последний пинг: Frosty решает тормоза Telegram — <b>{price} ₽/мес</b>.{ref_line}\n\n<i>/stop</i>",
                ),
                (
                    "B",
                    "{greeting}, если нужен стабильный Telegram без танцев — Frosty, <b>{price} ₽/мес</b>.{ref_line}\n\n<i>/stop</i>",
                ),
            ],
        },
        {
            "slug": "trial_followup_1",
            "name": "Trial follow-up #1 (+30м)",
            "kind": CAMPAIGN_KIND_DRIP,
            "audience": AUDIENCE_TRIAL_ENDED,
            "anchor": ANCHOR_TRIAL_ENDS,
            "offset_min": 30,
            "variants": [
                (
                    "A",
                    "{greeting}, пробный день закончился — верни доступ за <b>{price} ₽/мес</b>.",
                ),
                (
                    "B",
                    "{greeting}, триал истёк. Оформи подписку <b>{price} ₽/мес</b> и продолжай без настройки заново.",
                ),
            ],
        },
        {
            "slug": "trial_followup_2",
            "name": "Trial follow-up #2 (+24ч)",
            "kind": CAMPAIGN_KIND_DRIP,
            "audience": AUDIENCE_TRIAL_ENDED,
            "anchor": ANCHOR_TRIAL_ENDS,
            "offset_min": 1440,
            "variants": [
                ("A", "{greeting}, напомню: Frosty = VPN, <b>{price} ₽/мес</b>."),
                ("B", "{greeting}, одна подписка — Telegram и соцсети, <b>{price} ₽/мес</b>."),
            ],
        },
        {
            "slug": "trial_followup_3",
            "name": "Trial follow-up #3 (+72ч)",
            "kind": CAMPAIGN_KIND_DRIP,
            "audience": AUDIENCE_TRIAL_ENDED,
            "anchor": ANCHOR_TRIAL_ENDS,
            "offset_min": 4320,
            "variants": [
                ("A", "{greeting}, последний мягкий пинг после триала — <b>{price} ₽/мес</b>.\n\n<i>/stop</i>"),
                ("B", "{greeting}, верни доступ в 2 клика — <b>{price} ₽/мес</b>.\n\n<i>/stop</i>"),
            ],
        },
    ]
    created = 0
    for spec in defaults:
        exists = db.execute(
            select(MarketingCampaign.id).where(MarketingCampaign.slug == spec["slug"]).limit(1)
        ).scalar_one_or_none()
        if exists is not None:
            continue
        camp = MarketingCampaign(
            slug=spec["slug"],
            name=spec["name"],
            kind=spec["kind"],
            status=CAMPAIGN_STATUS_ACTIVE,
            audience=spec["audience"],
            trigger_anchor=spec["anchor"],
            trigger_offset_minutes=spec["offset_min"],
            cta_type=CTA_MINIAPP,
            cta_label="💳 Оформить подписку",
            ai_prompt=f"Варианты для {spec['name']}, цена {price_rub} ₽",
        )
        db.add(camp)
        db.flush()
        for key, msg in spec["variants"]:
            db.add(
                CampaignVariant(
                    campaign_id=camp.id,
                    variant_key=key,
                    weight=50,
                    message_html=msg,
                    is_ai_generated=False,
                )
            )
        created += 1
    if created:
        db.commit()
    return created


def refresh_default_campaign_copy(db: Session, *, price_rub: int) -> int:
    """Обновить тексты дефолтных A/B-вариантов (без AI), если кампания уже есть в БД."""
    defaults = [
        {
            "slug": "sales_nudge_1",
            "variants": [
                (
                    "A",
                    "{greeting}, коротко напомню: <b>Frosty</b> — VPN за <b>{price} ₽/мес</b>.{ref_line}\n\n<i>/stop</i>",
                ),
                (
                    "B",
                    "{greeting}, Telegram без VPN: <b>Frosty</b> ускоряет мессенджер и даёт VPN для соцсетей — <b>{price} ₽/мес</b>.{ref_line}\n\n<i>/stop</i>",
                ),
            ],
        },
        {
            "slug": "sales_nudge_2",
            "variants": [
                (
                    "A",
                    "{greeting}, в Frosty и Telegram, и Instagram через один VPN — <b>{price} ₽/мес</b>.{ref_line}\n\n<i>/stop</i>",
                ),
                (
                    "B",
                    "{greeting}, один раз настроил — работают Telegram и TikTok. <b>{price} ₽/мес</b>.{ref_line}\n\n<i>/stop</i>",
                ),
            ],
        },
        {
            "slug": "sales_nudge_3",
            "variants": [
                (
                    "A",
                    "{greeting}, последний пинг: Frosty решает тормоза Telegram — <b>{price} ₽/мес</b>.{ref_line}\n\n<i>/stop</i>",
                ),
                (
                    "B",
                    "{greeting}, если нужен стабильный Telegram без танцев — Frosty, <b>{price} ₽/мес</b>.{ref_line}\n\n<i>/stop</i>",
                ),
            ],
        },
        {
            "slug": "trial_followup_1",
            "variants": [
                (
                    "A",
                    "{greeting}, пробный день закончился — верни доступ за <b>{price} ₽/мес</b>.",
                ),
                (
                    "B",
                    "{greeting}, триал истёк. Оформи подписку <b>{price} ₽/мес</b> и продолжай без настройки заново.",
                ),
            ],
        },
        {
            "slug": "trial_followup_2",
            "variants": [
                ("A", "{greeting}, напомню: Frosty = VPN, <b>{price} ₽/мес</b>."),
                ("B", "{greeting}, одна подписка — Telegram и соцсети, <b>{price} ₽/мес</b>."),
            ],
        },
        {
            "slug": "trial_followup_3",
            "variants": [
                ("A", "{greeting}, последний мягкий пинг после триала — <b>{price} ₽/мес</b>.\n\n<i>/stop</i>"),
                ("B", "{greeting}, верни доступ в 2 клика — <b>{price} ₽/мес</b>.\n\n<i>/stop</i>"),
            ],
        },
    ]
    updated = 0
    for spec in defaults:
        camp_id = db.execute(
            select(MarketingCampaign.id).where(MarketingCampaign.slug == spec["slug"]).limit(1)
        ).scalar_one_or_none()
        if camp_id is None:
            continue
        for key, msg in spec["variants"]:
            row = db.execute(
                select(CampaignVariant).where(
                    CampaignVariant.campaign_id == camp_id,
                    CampaignVariant.variant_key == key,
                    CampaignVariant.is_ai_generated == False,  # noqa: E712
                ).limit(1)
            ).scalar_one_or_none()
            if row is None:
                continue
            if row.message_html != msg:
                row.message_html = msg
                updated += 1
    if updated:
        db.commit()
    return updated


def run_push_campaign(
    db: Session,
    campaign_id: int,
    *,
    send_tg: Callable[[int, str, dict | None], bool],
    miniapp_url_fn: Callable[[int], str],
    paid_clause: Any,
    include_opted_out: bool = False,
) -> tuple[list[int], int]:
    camp = db.get(MarketingCampaign, campaign_id)
    if camp is None or camp.kind != CAMPAIGN_KIND_PUSH:
        raise ValueError("push campaign not found")
    variants = db.execute(
        select(CampaignVariant).where(CampaignVariant.campaign_id == campaign_id)
    ).scalars().all()
    if not variants:
        raise ValueError("no variants")
    q = select(User).where(User.telegram_id > 0)
    if not include_opted_out:
        q = q.where(User.marketing_opt_out == False)  # noqa: E712
    users = db.execute(q).scalars().all()
    paid_set = _paid_tg_ids(db, paid_clause)
    audience = (camp.audience or AUDIENCE_BROADCAST).strip()
    ids: list[int] = []
    now = _utcnow()
    sent = 0
    for user in users:
        tg = int(user.telegram_id)
        if audience == AUDIENCE_NON_PAYER and tg in paid_set:
            continue
        already = db.execute(
            select(CampaignDelivery.id)
            .where(CampaignDelivery.campaign_id == campaign_id, CampaignDelivery.telegram_id == tg)
            .limit(1)
        ).scalar_one_or_none()
        if already is not None:
            continue
        variant = _stable_variant(variants, tg, campaign_id)
        text = _render_placeholders(variant.message_html, user, price_rub=int(os.getenv("PAYMENT_AMOUNT_RUB", "299")))
        delivery = CampaignDelivery(
            campaign_id=campaign_id,
            variant_id=variant.id,
            telegram_id=tg,
            sent_at=now,
            delivered_ok=False,
        )
        db.add(delivery)
        db.flush()
        kb = _campaign_keyboard(camp, delivery.id, tg, miniapp_url_fn=miniapp_url_fn)
        ok = send_tg(tg, text, kb)
        delivery.delivered_ok = bool(ok)
        if ok:
            sent += 1
            ids.append(tg)
    db.commit()
    return ids, sent


def send_campaign_test(
    db: Session,
    campaign_id: int,
    tg_id: int,
    *,
    send_tg: Callable[[int, str, dict | None], bool],
    miniapp_url_fn: Callable[[int], str],
    price_rub: int,
) -> dict[str, Any]:
    """Send one campaign message to a single Telegram ID (admin smoke test)."""
    from types import SimpleNamespace

    camp = db.get(MarketingCampaign, campaign_id)
    if camp is None:
        raise ValueError("campaign not found")
    variants = db.execute(
        select(CampaignVariant).where(CampaignVariant.campaign_id == campaign_id).order_by(CampaignVariant.variant_key)
    ).scalars().all()
    if not variants:
        raise ValueError("no variants")
    user = db.execute(select(User).where(User.telegram_id == tg_id)).scalar_one_or_none()
    if user is None:
        user = SimpleNamespace(telegram_id=tg_id, first_name="Тест", username=None, ref_source=None)
    variant = variants[0]
    body = _render_placeholders(variant.message_html, user, price_rub=price_rub)
    text = f"🧪 <b>Тест кампании</b> «{html.escape(camp.name)}»\n\n{body}"
    now = _utcnow()
    delivery = CampaignDelivery(
        campaign_id=campaign_id,
        variant_id=variant.id,
        telegram_id=tg_id,
        sent_at=now,
        delivered_ok=False,
    )
    db.add(delivery)
    db.flush()
    kb = _campaign_keyboard(camp, delivery.id, tg_id, miniapp_url_fn=miniapp_url_fn)
    ok = send_tg(tg_id, text, kb)
    delivery.delivered_ok = bool(ok)
    if not ok:
        delivery.error = "send_failed"
    db.commit()
    return {
        "ok": bool(ok),
        "telegram_id": tg_id,
        "variant_key": variant.variant_key,
        "delivery_id": delivery.id,
    }
