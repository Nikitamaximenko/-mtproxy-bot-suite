#!/usr/bin/env python3
"""Merge checkout_logs and support_ai_messages from Railway into VPS SQLite."""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request

RAILWAY = os.getenv("RAILWAY_URL", "https://mtproxy-bot-suite-production.up.railway.app").rstrip("/")
ADMIN_KEY = os.getenv("ADMIN_API_KEY", "").strip()
DB_PATH = os.getenv("DB_PATH", "/opt/frostyvpn/backend/app.db")


def fetch_json(path: str) -> dict:
    req = urllib.request.Request(
        f"{RAILWAY}{path}",
        headers={"x-admin-key": ADMIN_KEY},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def norm_dt(raw: str | None) -> str | None:
    if not raw:
        return None
    s = str(raw).replace("Z", "").replace("T", " ")
    if "+" in s:
        s = s.split("+")[0]
    return s[:26]


def import_checkout(conn: sqlite3.Connection) -> int:
    data = fetch_json("/admin/checkout/logs?limit=500")
    cur = conn.cursor()
    n = 0
    for row in data.get("logs") or []:
        created = norm_dt(row.get("created_at"))
        cur.execute(
            """
            SELECT 1 FROM checkout_logs
            WHERE source=? AND stage=? AND IFNULL(telegram_id,'')=IFNULL(?, '')
              AND IFNULL(payment_token,'')=IFNULL(?, '') AND created_at=?
            """,
            (
                row.get("source"),
                row.get("stage"),
                row.get("telegram_id"),
                row.get("payment_token"),
                created,
            ),
        )
        if cur.fetchone():
            continue
        cur.execute(
            """
            INSERT INTO checkout_logs
              (source, stage, provider, telegram_id, username, email, customer_email,
               payment_token, ok, payment_url, error, details, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                row.get("source"),
                row.get("stage"),
                row.get("provider"),
                row.get("telegram_id"),
                row.get("username"),
                row.get("email"),
                row.get("customer_email"),
                row.get("payment_token"),
                1 if row.get("ok") else 0,
                row.get("payment_url"),
                row.get("error"),
                row.get("details"),
                created,
            ),
        )
        n += 1
    conn.commit()
    return n


def import_support(conn: sqlite3.Connection) -> int:
    data = fetch_json("/admin/support/messages?limit=500")
    cur = conn.cursor()
    n = 0
    for row in data.get("messages") or []:
        created = norm_dt(row.get("created_at"))
        cur.execute(
            """
            SELECT 1 FROM support_ai_messages
            WHERE telegram_id=? AND user_text=? AND created_at=?
            """,
            (row.get("telegram_id"), row.get("user_text"), created),
        )
        if cur.fetchone():
            continue
        cur.execute(
            """
            INSERT INTO support_ai_messages
              (telegram_id, username, user_text, assistant_text, model, duration_ms, ok, error, created_at)
            VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (
                row.get("telegram_id"),
                row.get("username"),
                row.get("user_text"),
                row.get("assistant_text"),
                row.get("model"),
                row.get("duration_ms"),
                1 if row.get("ok") else 0,
                row.get("error"),
                created,
            ),
        )
        n += 1
    conn.commit()
    return n


def main() -> int:
    if not ADMIN_KEY:
        print("ADMIN_API_KEY required", file=sys.stderr)
        return 1
    conn = sqlite3.connect(DB_PATH)
    try:
        checkout_n = import_checkout(conn)
        support_n = import_support(conn)
        print(f"imported checkout_logs: {checkout_n}")
        print(f"imported support_ai_messages: {support_n}")
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM checkout_logs")
        print(f"checkout_logs total: {cur.fetchone()[0]}")
        cur.execute("SELECT count(*) FROM support_ai_messages")
        print(f"support_ai_messages total: {cur.fetchone()[0]}")
    except urllib.error.URLError as e:
        print(f"fetch failed: {e}", file=sys.stderr)
        return 1
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
