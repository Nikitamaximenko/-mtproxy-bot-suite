#!/usr/bin/env bash
# Reality в стиле Hit VPN: домен в serverNames, клиент подключается по host=SNI.
# Запуск на VPS: bash /opt/frostyvpn/scripts/vps-reality-hit-style.sh
set -euo pipefail

DOMAIN="${XRAY_HIT_DOMAIN:-138-124-80-97.sslip.io}"
ENV_FILE="${ENV_FILE:-/opt/frostyvpn/backend/.env}"

python3 <<PY
import json, sqlite3

DOMAIN = "${DOMAIN}"

p = "/usr/local/x-ui/bin/config.json"
cfg = json.load(open(p))
for ib in cfg.get("inbounds", []):
    if ib.get("protocol") != "vless":
        continue
    st = ib.setdefault("streamSettings", {})
    rs = st.setdefault("realitySettings", {})
    names = list(rs.get("serverNames") or [])
    if DOMAIN not in names:
        names.append(DOMAIN)
    rs["serverNames"] = names
    if not rs.get("dest"):
        rs["dest"] = "www.microsoft.com:443"
json.dump(cfg, open(p, "w"), indent=2)

db = sqlite3.connect("/etc/x-ui/x-ui.db")
for row in db.execute("select id, stream_settings from inbounds where protocol='vless'"):
    ib_id, ss = row
    st = json.loads(ss or "{}")
    rs = st.setdefault("realitySettings", {})
    names = list(rs.get("serverNames") or [])
    if DOMAIN not in names:
        names.append(DOMAIN)
    rs["serverNames"] = names
    db.execute(
        "update inbounds set stream_settings=? where id=?",
        (json.dumps(st), ib_id),
    )
db.commit()
db.close()
print("serverNames +", DOMAIN)
PY

set_kv() {
  local k="$1" v="$2"
  if grep -q "^${k}=" "$ENV_FILE"; then
    sed -i "s|^${k}=.*|${k}=${v}|" "$ENV_FILE"
  else
    echo "${k}=${v}" >> "$ENV_FILE"
  fi
}

set_kv XRAY_CLIENT_HOST "$DOMAIN"
set_kv XRAY_SNI "$DOMAIN"
set_kv XRAY_FP firefox
set_kv XRAY_CLIENT_PORT 443

x-ui restart
sleep 5
echo "OK Hit-style Reality: host/sni=$DOMAIN fp=firefox"
