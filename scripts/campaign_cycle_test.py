#!/usr/bin/env python3
"""
Полный smoke/cycle тест маркетинговых кампаний.

Режимы:
  --ci          юнит-тесты (scripts/test_campaign_engine.py)
  --api         проверка прод API (нужны BACKEND_URL, ADMIN_API_KEY)
  --on-vps      на VPS: health + БД + seed + stats (без внешнего API)

Env:
  BACKEND_URL, ADMIN_API_KEY — для --api
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]


def _http(method: str, url: str, headers: dict | None = None, body: dict | None = None) -> tuple[int, dict | str]:
    h = {"Accept": "application/json", **(headers or {})}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode() if e.fp else ""
        try:
            return e.code, json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            return e.code, raw


def run_ci() -> int:
    r = subprocess.run([sys.executable, str(_REPO / "scripts/test_campaign_engine.py")], check=False)
    return r.returncode


def run_api() -> int:
    base = (os.environ.get("BACKEND_URL") or "").rstrip("/")
    key = (os.environ.get("ADMIN_API_KEY") or "").strip()
    if not base or not key:
        print("FAIL: BACKEND_URL and ADMIN_API_KEY required for --api")
        return 1
    headers = {"x-admin-key": key}
    code, health = _http("GET", f"{base}/health")
    print(f"health: {code} {health}")
    if code != 200:
        return 1
    code, data = _http("GET", f"{base}/admin/campaigns", headers=headers)
    print(f"campaigns list: {code}")
    if code != 200 or not isinstance(data, dict):
        print(data)
        return 1
    campaigns = data.get("campaigns") or []
    print(f"  campaigns count: {len(campaigns)}")
    if len(campaigns) < 1:
        print("WARN: no campaigns yet (seed on backend restart?)")
    for c in campaigns[:3]:
        cid = c.get("id")
        if not cid:
            continue
        sc, stats = _http("GET", f"{base}/admin/campaigns/{cid}/stats", headers=headers)
        if sc == 200 and isinstance(stats, dict):
            print(f"  stats {c.get('slug')}: sent={stats.get('total_sent')} variants={len(stats.get('variants') or [])}")
    print("OK: API cycle passed")
    return 0


def run_on_vps() -> int:
    sys.path.insert(0, "/opt/frostyvpn/backend")
    os.chdir("/opt/frostyvpn/backend")
    import campaign_engine as ce  # type: ignore
    import main  # type: ignore

    ce.bind_models(
        marketing_campaign=main.MarketingCampaign,
        campaign_variant=main.CampaignVariant,
        campaign_delivery=main.CampaignDelivery,
        campaign_event=main.CampaignEvent,
        user=main.User,
        subscription=main.Subscription,
    )
    db = main.SessionLocal()
    try:
        seeded = ce.seed_default_campaigns(db, price_rub=int(os.getenv("PAYMENT_AMOUNT_RUB", "299")))
        print(f"seeded_new: {seeded}")
        rows = db.execute(__import__("sqlalchemy").select(main.MarketingCampaign)).scalars().all()
        print(f"campaigns_total: {len(rows)}")
        active = [c for c in rows if c.status == ce.CAMPAIGN_STATUS_ACTIVE]
        print(f"campaigns_active: {len(active)}")
        for c in active[:6]:
            st = ce.campaign_stats(db, c.id)
            print(f"  {c.slug}: sent={st['total_sent']} variants={len(st['variants'])}")
    finally:
        db.close()
    code, health = _http("GET", "http://127.0.0.1:8000/health")
    print(f"local health: {code} {health}")
    return 0 if code == 200 else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ci", action="store_true")
    ap.add_argument("--api", action="store_true")
    ap.add_argument("--on-vps", action="store_true")
    args = ap.parse_args()
    if args.ci:
        return run_ci()
    if args.api:
        return run_api()
    if args.on_vps:
        return run_on_vps()
    # default: ci then api if credentials
    rc = run_ci()
    if rc != 0:
        return rc
    if os.environ.get("BACKEND_URL") and os.environ.get("ADMIN_API_KEY"):
        return run_api()
    print("SKIP api (no BACKEND_URL/ADMIN_API_KEY)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
