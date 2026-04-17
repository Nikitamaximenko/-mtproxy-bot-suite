#!/usr/bin/env python3
"""
Frosty system audit — read-only проверка всей связки payments ↔ subscriptions ↔ DB ↔ VPN.

Пишет NDJSON-диагностику в .cursor/debug-5f0ad3.log для debug-сессии.

Проверяет гипотезы H1..H7 (+ сводка по инфраструктуре). НЕ ДЕЛАЕТ ДЕСТРУКТИВНЫХ ДЕЙСТВИЙ.
Self-test тумблера запускается, только если явно передать --with-self-test
(и только на указанном SELF_TEST_TG_ID).

Env vars:
  BACKEND_URL          (required) https://mtproxy-bot-suite-production.up.railway.app
  ADMIN_API_KEY        (required) админ-ключ бэкенда (заголовок x-admin-key)
  INTERNAL_API_TOKEN   (required) внутренний токен (заголовок X-Internal-Token)
  SELF_TEST_TG_ID      (optional) tg_id для --with-self-test
  AUDIT_MAX_USERS      (optional) макс. число активных платников для глубокой проверки (default 150)
  AUDIT_LOG_PATH       (optional) путь к NDJSON-логу (default: <repo>/.cursor/debug-5f0ad3.log)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

SESSION_ID = "5f0ad3"

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _default_log_path() -> str:
    p = os.environ.get("AUDIT_LOG_PATH", "").strip()
    if p:
        return p
    d = os.path.join(_REPO_ROOT, ".cursor")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "debug-5f0ad3.log")


LOG_PATH = _default_log_path()
RUN_ID = f"audit-{int(time.time())}"


def log(hypothesis_id: str, location: str, message: str, data: dict | None = None) -> None:
    payload = {
        "sessionId": SESSION_ID,
        "id": f"log_{int(time.time() * 1000)}_{os.urandom(3).hex()}",
        "timestamp": int(time.time() * 1000),
        "location": location,
        "message": message,
        "data": data or {},
        "runId": RUN_ID,
        "hypothesisId": hypothesis_id,
    }
    line = json.dumps(payload, ensure_ascii=False, default=str)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")
    # Дублируем в stdout для живой обратной связи
    print(f"[{hypothesis_id}] {location}  {message}  {json.dumps(data or {}, ensure_ascii=False, default=str)[:240]}")


def http(method: str, url: str, headers: dict | None = None, body: dict | None = None, timeout: int = 20) -> tuple[int, dict | list | str]:
    req_headers = {"Accept": "application/json", **(headers or {})}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.getcode(), json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                return resp.getcode(), raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if e.fp else ""
        try:
            return e.code, json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            return e.code, raw
    except Exception as e:  # noqa: BLE001
        return -1, f"network_error:{e}"


def parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except Exception:  # noqa: BLE001
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--with-self-test", action="store_true", help="прогнать /admin/self-test-toggle на SELF_TEST_TG_ID")
    args = ap.parse_args()

    # Логируем сам факт старта — чтобы было видно в debug-логе, что скрипт запускался.
    log("H0", "scripts/system_audit.py:boot", "audit started", {
        "run_id": RUN_ID,
        "with_self_test": bool(args.with_self_test),
        "python": sys.version.split()[0],
        "cwd": os.getcwd(),
    })

    # Fallback: если env-переменные не заданы, пробуем подхватить их из .env.audit
    # рядом с корнем репо — чтобы не приходилось каждый раз export-ить.
    env_file = os.path.join(_REPO_ROOT, ".env.audit")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k and k not in os.environ:
                        os.environ[k] = v
            log("H0", "scripts/system_audit.py:env", f"loaded env overrides from {env_file}", {})
        except Exception as e:  # noqa: BLE001
            log("H0", "scripts/system_audit.py:env", f"failed to read {env_file}: {e}", {})

    backend = (os.getenv("BACKEND_URL") or "").rstrip("/")
    admin_key = os.getenv("ADMIN_API_KEY") or ""
    internal_token = os.getenv("INTERNAL_API_TOKEN") or ""

    # Санити-лог по env-переменным БЕЗ раскрытия секретов.
    log("H0", "scripts/system_audit.py:env", "env presence", {
        "BACKEND_URL": backend if backend else "(empty)",
        "ADMIN_API_KEY_len": len(admin_key),
        "INTERNAL_API_TOKEN_len": len(internal_token),
        "SELF_TEST_TG_ID": os.getenv("SELF_TEST_TG_ID") or "(empty)",
    })

    missing = [name for name, val in [
        ("BACKEND_URL", backend),
        ("ADMIN_API_KEY", admin_key),
        ("INTERNAL_API_TOKEN", internal_token),
    ] if not val]
    if missing:
        log("H0", "scripts/system_audit.py:env", "ABORT: missing env vars", {"missing": missing})
        print(f"ERROR: missing env vars: {', '.join(missing)}", file=sys.stderr)
        print("Установи их в окружении и запусти снова, например:", file=sys.stderr)
        print('  export BACKEND_URL="https://mtproxy-bot-suite-production.up.railway.app"', file=sys.stderr)
        print('  export ADMIN_API_KEY="..."', file=sys.stderr)
        print('  export INTERNAL_API_TOKEN="..."', file=sys.stderr)
        return 2

    admin_h = {"x-admin-key": admin_key}
    internal_h = {"X-Internal-Token": internal_token}

    # ─── 1. Infra smoke ────────────────────────────────────────────────
    t0 = time.time()
    code, body = http("GET", f"{backend}/admin/proxy-status", headers=admin_h)
    log("H0", "scripts/system_audit.py:smoke", "proxy-status", {"http": code, "body": body, "elapsed_ms": int((time.time() - t0) * 1000)})

    code, vpn_online = http("GET", f"{backend}/admin/vpn-online", headers=admin_h)
    log("H0", "scripts/system_audit.py:smoke", "vpn-online", {"http": code, "body": vpn_online})

    # ─── 2. Загрузить список подписчиков ──────────────────────────────
    code, overview = http("GET", f"{backend}/admin/users-overview?limit=2000", headers=admin_h)
    if code != 200 or not isinstance(overview, dict):
        log("H0", "scripts/system_audit.py:overview", "FATAL: не удалось получить users-overview", {"http": code, "body": overview})
        return 1

    subscribers = overview.get("subscribers") or []
    log(
        "H0",
        "scripts/system_audit.py:overview",
        f"получено подписчиков: {len(subscribers)}",
        {
            "subscribers_total": overview.get("subscribers_total"),
            "new_users_total": overview.get("new_users_total"),
            "users_table_total": overview.get("users_table_total"),
            "analytics_scoped": overview.get("analytics_scoped"),
        },
    )

    now = datetime.now(timezone.utc)

    # агрегаторы для финального вердикта по каждой гипотезе
    counters: dict[str, list] = {h: [] for h in ("H1", "H2", "H3", "H5", "H6", "H7", "H9", "HWARN")}

    paid_rows = []
    expired_or_suspended_rows = []
    per_tg_paid_count: dict[int, int] = {}

    for s in subscribers:
        tg = int(s.get("telegram_id") or 0)
        if tg <= 0:
            continue
        exp = parse_iso(s.get("expires_at"))
        payment_status = s.get("payment_status")
        suspended = bool(s.get("access_suspended"))
        is_active_now = payment_status == "paid" and exp is not None and exp > now and not suspended

        if is_active_now:
            paid_rows.append(s)
        else:
            expired_or_suspended_rows.append(s)

        if payment_status == "paid":
            per_tg_paid_count[tg] = per_tg_paid_count.get(tg, 0) + 1

    log(
        "H0",
        "scripts/system_audit.py:overview",
        "сегментация подписчиков",
        {"active_paid": len(paid_rows), "expired_or_suspended": len(expired_or_suspended_rows)},
    )

    code, stats_body = http("GET", f"{backend}/admin/stats", headers=admin_h)
    log("H0", "scripts/system_audit.py:stats", "admin/stats", {"http": code, "body": stats_body if isinstance(stats_body, (dict, list)) else str(stats_body)[:500]})

    max_deep = int(os.getenv("AUDIT_MAX_USERS", "150") or "150")
    if max_deep < 1:
        max_deep = 150
    paid_for_deep = paid_rows[:max_deep]
    if len(paid_rows) > max_deep:
        log("H0", "scripts/system_audit.py:limit", f"глубокая проверка ограничена {max_deep} из {len(paid_rows)} активных платников", {"AUDIT_MAX_USERS": max_deep})

    # ─── H1 + H2 + H7: активные платные → проверить /subscription/{tg} и /vpn/config/{tg} ───
    for s in paid_for_deep:
        tg = int(s["telegram_id"])

        code_s, sub_resp = http("GET", f"{backend}/subscription/{tg}", headers=internal_h)
        code_v, vpn_resp = http("GET", f"{backend}/vpn/config/{tg}", headers=internal_h)

        overview_vpn_active = s.get("vpn_active")

        # H2: /admin/users-overview считает active, а /subscription говорит active=false
        if isinstance(sub_resp, dict) and sub_resp.get("active") is not True:
            counters["H2"].append(
                {
                    "telegram_id": tg,
                    "username": s.get("username"),
                    "overview_says": "active (paid, expires>now, not suspended)",
                    "subscription_endpoint_says": sub_resp,
                    "http": code_s,
                }
            )
            log("H2", "scripts/system_audit.py:H2", f"рассинхрон overview↔subscription для tg={tg}", {
                "sub_http": code_s, "sub_resp": sub_resp, "overview_row": s,
            })

        # H7: подписка активна, но proxy_link не выдался (null)
        if isinstance(sub_resp, dict) and sub_resp.get("active") is True and not sub_resp.get("proxy_link"):
            counters["H7"].append(
                {"telegram_id": tg, "username": s.get("username"), "subscription_endpoint_says": sub_resp}
            )
            log("H7", "scripts/system_audit.py:H7", f"active=true, proxy_link=null для tg={tg}", {
                "sub_resp": sub_resp, "overview_row": s,
            })

        # H9: в админке has_proxy=false при активной подписке (креды MTProxy не записаны в БД)
        if not bool(s.get("has_proxy")):
            counters["H9"].append({"telegram_id": tg, "username": s.get("username"), "row": s})
            log("H9", "scripts/system_audit.py:H9", f"активный платник без has_proxy tg={tg}", {"row": s})

        # H1: подписка активна, но VPN-клиента в 3X-UI нет / застрял в creating / vpn_not_configured
        if isinstance(vpn_resp, dict):
            reason = vpn_resp.get("reason")
            vless = vpn_resp.get("vless_link")
            has_vpn = bool(vpn_resp.get("available") and vless)

            # Не смешиваем с поломкой инфраструктуры: если токен на бэкенде задан, а запрос
            # пришёл без валидного X-Internal-Token — это конфиг клиента, не «сломан VPN».
            if reason == "internal_token_required":
                counters["HWARN"].append({"telegram_id": tg, "vpn_config": vpn_resp})
                log("HWARN", "scripts/system_audit.py:HWARN", f"/vpn/config: internal_token_required для tg={tg} — проверьте, что скрипт шлёт тот же токен, что на бэкенде", {"http": code_v})
            elif not has_vpn:
                counters["H1"].append(
                    {
                        "telegram_id": tg,
                        "username": s.get("username"),
                        "vpn_config": vpn_resp,
                        "overview_vpn_active": overview_vpn_active,
                        "http": code_v,
                    }
                )
                log("H1", "scripts/system_audit.py:H1", f"нет рабочего VPN для активного платника tg={tg}", {
                    "vpn_resp": vpn_resp, "overview_vpn_active": overview_vpn_active, "http": code_v,
                })

            # Кросс-проверка: overview.vpn_active vs реальный ответ /vpn/config
            if overview_vpn_active is True and not has_vpn and reason != "internal_token_required":
                log("H1", "scripts/system_audit.py:H1", f"overview.vpn_active=true, но /vpn/config без vless_link для tg={tg}", {
                    "vpn_resp": vpn_resp, "overview_row": s,
                })

    # ─── H3: неактивные (expired/suspended/pending) → не должно быть vpn_active=true ───
    for s in expired_or_suspended_rows:
        tg = int(s["telegram_id"])
        vpn_active = s.get("vpn_active")
        if vpn_active is True:
            counters["H3"].append(
                {
                    "telegram_id": tg,
                    "username": s.get("username"),
                    "payment_status": s.get("payment_status"),
                    "expires_at": s.get("expires_at"),
                    "access_suspended": s.get("access_suspended"),
                    "vpn_uuid": s.get("vpn_uuid"),
                }
            )
            log("H3", "scripts/system_audit.py:H3", f"ghost VPN: неактивный юзер tg={tg} с vpn_active=true", {"row": s})

    # ─── H5: «сироты» — paid, но expires_at=null или <now, и payment_status не переведён в expired ───
    for s in subscribers:
        exp = parse_iso(s.get("expires_at"))
        ps = s.get("payment_status")
        if ps == "paid":
            if exp is None:
                counters["H5"].append({"telegram_id": s.get("telegram_id"), "reason": "paid_without_expires_at", "row": s})
                log("H5", "scripts/system_audit.py:H5", f"paid без expires_at для tg={s.get('telegram_id')}", {"row": s})
            elif exp < now:
                counters["H5"].append({"telegram_id": s.get("telegram_id"), "reason": "paid_with_past_expires_at", "row": s})
                log("H5", "scripts/system_audit.py:H5", f"paid, но expires_at в прошлом для tg={s.get('telegram_id')}", {"row": s})

    # ─── H6: дубли paid-подписок для одного tg ───
    for tg, cnt in per_tg_paid_count.items():
        if cnt > 1:
            counters["H6"].append({"telegram_id": tg, "paid_rows_count": cnt})
            log("H6", "scripts/system_audit.py:H6", f"дубли paid-подписок для tg={tg}: {cnt}", {"count": cnt})

    # ─── H4 (optional, requires --with-self-test) ──────────────────
    if args.with_self_test:
        tg = os.getenv("SELF_TEST_TG_ID") or ""
        if not tg.isdigit():
            log("H4", "scripts/system_audit.py:H4", "пропуск: SELF_TEST_TG_ID не задан/некорректен", {"env": tg})
        else:
            code_st, st_resp = http("POST", f"{backend}/admin/self-test-toggle", headers=admin_h, body={"telegram_ids": [int(tg)]}, timeout=60)
            log("H4", "scripts/system_audit.py:H4", "self-test-toggle выполнен", {"http": code_st, "body": st_resp})
            if isinstance(st_resp, dict):
                results = st_resp.get("results") or []
                for r in results:
                    passed = r.get("passed")
                    if passed is False:
                        log("H4", "scripts/system_audit.py:H4", f"self-test FAIL для tg={r.get('telegram_id')}", {"result": r})
    else:
        log("H4", "scripts/system_audit.py:H4", "пропущено (флаг --with-self-test не передан)", {})

    # ─── Финальный сводный вердикт ─────────────────────────────────
    verdict = {
        h: {"count": len(v), "examples": v[:5]}
        for h, v in counters.items()
    }
    log("H0", "scripts/system_audit.py:verdict", "===== СВОДКА =====", verdict)
    print("\n===== СВОДКА =====")
    for h, info in verdict.items():
        print(f"  {h}: {info['count']}")
    print(f"\nЛог полностью: {LOG_PATH}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
