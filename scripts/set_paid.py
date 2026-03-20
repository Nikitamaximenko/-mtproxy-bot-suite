#!/usr/bin/env python3
"""
Set subscription to paid for a telegram_id.
Run from project root. Uses backend/.env for DATABASE_URL.
Usage: python scripts/set_paid.py 231115635

If bot shows "Подписка не активна" — run this on the SAME server where backend runs
(where the bot's BACKEND_BASE_URL points to).
"""
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from uuid import uuid4

# Load backend env
env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db").strip()
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/set_paid.py <telegram_id>")
        sys.exit(1)
    tg_id = int(sys.argv[1])

    # Resolve sqlite path: ./app.db is relative to backend dir when backend runs
    if DATABASE_URL.startswith("sqlite:///./"):
        db_file = BACKEND_DIR / DATABASE_URL.replace("sqlite:///./", "")
    else:
        db_file = DATABASE_URL.replace("sqlite:///", "")

    import sqlite3
    conn = sqlite3.connect(str(db_file))
    cur = conn.cursor()

    cur.execute(
        "SELECT id FROM subscriptions WHERE telegram_id = ? ORDER BY created_at DESC LIMIT 1",
        (tg_id,),
    )
    row = cur.fetchone()

    now = datetime.now(timezone.utc).isoformat()
    expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    proxy_s, proxy_p, proxy_sec = "176.123.161.97", 443, "dd645eba01a59f188b5ba9db2564b44a00"

    if row:
        cur.execute(
            """UPDATE subscriptions SET payment_status = 'paid', expires_at = ?,
               proxy_server = ?, proxy_port = ?, proxy_secret = ? WHERE id = ?""",
            (expires, proxy_s, proxy_p, proxy_sec, row[0]),
        )
        print(f"OK: subscription id={row[0]} for tg_id={tg_id} -> paid")
    else:
        cur.execute(
            """INSERT INTO subscriptions (telegram_id, payment_token, payment_status,
               expires_at, proxy_server, proxy_port, proxy_secret, created_at)
               VALUES (?, ?, 'paid', ?, ?, ?, ?, ?)""",
            (tg_id, str(uuid4()), expires, proxy_s, proxy_p, proxy_sec, now),
        )
        print(f"OK: created paid subscription for tg_id={tg_id}")
    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()
