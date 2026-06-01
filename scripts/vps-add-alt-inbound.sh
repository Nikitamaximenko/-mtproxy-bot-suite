#!/usr/bin/env bash
# Резервный VLESS Reality inbound (порт 2053) — обход DPI, когда :443 режут по IP/порту.
set -euo pipefail

ALT_PORT="${ALT_PORT:-2053}"

python3 <<PY
import json, sqlite3

ALT = int("${ALT_PORT}")

db = sqlite3.connect("/etc/x-ui/x-ui.db")
cur = db.cursor()
cur.execute("SELECT id FROM inbounds WHERE port=?", (ALT,))
if cur.fetchone():
    print(f"Inbound :{ALT} already exists")
    db.close()
    raise SystemExit(0)

cur.execute(
    """SELECT user_id, remark, listen, protocol, settings, stream_settings, tag, sniffing
       FROM inbounds WHERE port=443 AND protocol='vless' LIMIT 1"""
)
row = cur.fetchone()
if not row:
    raise SystemExit("No VLESS inbound on 443")
user_id, remark, listen, protocol, settings, stream_settings, tag, sniffing = row
cur.execute(
    """INSERT INTO inbounds
       (user_id, up, down, total, all_time, remark, enable, expiry_time,
        traffic_reset, last_traffic_reset_time, listen, port, protocol,
        settings, stream_settings, tag, sniffing)
       VALUES (?, 0, 0, 0, 0, ?, 1, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?)""",
    (
        user_id,
        f"{remark}-alt-{ALT}",
        listen or "",
        ALT,
        protocol,
        settings,
        stream_settings,
        f"{tag}-alt-{ALT}",
        sniffing,
    ),
)
db.commit()
print(f"Created x-ui inbound :{ALT}")
db.close()

p = "/usr/local/x-ui/bin/config.json"
cfg = json.load(open(p))
src = next((ib for ib in cfg.get("inbounds", []) if ib.get("port") == 443 and ib.get("protocol") == "vless"), None)
if not src:
    raise SystemExit("No xray inbound 443 in config.json")
if any(ib.get("port") == ALT for ib in cfg.get("inbounds", [])):
    print("config.json already has alt port")
else:
    alt = json.loads(json.dumps(src))
    alt["port"] = ALT
    alt["tag"] = f"{src.get('tag', 'inbound')}-alt-{ALT}"
    cfg.setdefault("inbounds", []).append(alt)
    json.dump(cfg, open(p, "w"), indent=2)
    print(f"Added :{ALT} to config.json")
PY

ufw allow "${ALT_PORT}/tcp" comment "Frosty VLESS alt DPI bypass" 2>/dev/null || true
x-ui restart
sleep 5
ss -tlnp | grep -E ":443 |:${ALT_PORT} " || true
echo "OK alt inbound ${ALT_PORT}"
