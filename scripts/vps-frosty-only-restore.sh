#!/usr/bin/env bash
# Восстановить Frosty VPN как единственный сервис на 443 (klodbot переехал).
# Запуск на VPS: bash /opt/frostyvpn/scripts/vps-frosty-only-restore.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/frostyvpn/backend/.env}"
REPO="${REPO:-/opt/frostyvpn}"

echo "==> 1. Отключить nginx stream на 443 (xray сам слушает 443)"
rm -f /etc/nginx/conf.d-stream/frosty-443-stream.conf
mv -f /etc/nginx/conf.d-stream/frosty-443-stream.conf.disabled \
  /etc/nginx/conf.d-stream/frosty-443-stream.conf.disabled.bak 2>/dev/null || true
nginx -t && systemctl reload nginx

echo "==> 2. x-ui: inbound VLESS на порту 443, sniffing on, flow vision"
python3 <<'PY'
import json, sqlite3
p = "/usr/local/x-ui/bin/config.json"
c = json.load(open(p))
for ib in c.get("inbounds", []):
    if ib.get("protocol") != "vless":
        continue
    ib["port"] = 443
    ib["listen"] = ""
    ib["sniffing"] = {
        "enabled": True,
        "destOverride": ["http", "tls", "quic"],
        "routeOnly": False,
    }
    for cl in ib.get("settings", {}).get("clients", []):
        cl["flow"] = "xtls-rprx-vision"
        cl["enable"] = True
json.dump(c, open(p, "w"), indent=2)
db = sqlite3.connect("/etc/x-ui/x-ui.db")
db.execute(
    "update inbounds set port=443, sniffing=? where protocol='vless'",
    (
        json.dumps(
            {
                "enabled": True,
                "destOverride": ["http", "tls", "quic"],
                "routeOnly": False,
            }
        ),
    ),
)
db.commit()
db.close()
PY
x-ui restart
sleep 5

echo "==> 3. .env XRAY_CLIENT_PORT=443"
if grep -q '^XRAY_CLIENT_PORT=' "$ENV_FILE"; then
  sed -i 's/^XRAY_CLIENT_PORT=.*/XRAY_CLIENT_PORT=443/' "$ENV_FILE"
else
  echo 'XRAY_CLIENT_PORT=443' >> "$ENV_FILE"
fi

echo "==> 4. listeners"
ss -tlnp | grep -E ':443 |:10443' || true
echo "Ожидается: xray на *:443, nginx stream 443 отсутствует"

echo "OK: Frosty-only on 443"
