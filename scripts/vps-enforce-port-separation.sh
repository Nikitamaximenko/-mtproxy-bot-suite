#!/usr/bin/env bash
# УСТАРЕЛО: klodbot на другом сервере — используйте vps-frosty-only-restore.sh
# Жёстко разделить Frosty VPN и klodbot на VPS. Запуск на сервере от root:
#   bash /opt/frostyvpn/scripts/vps-enforce-port-separation.sh
set -euo pipefail

REPO="${REPO:-/opt/frostyvpn}"
STREAM_SRC="$REPO/scripts/vps-nginx-443-stream.conf"
STREAM_DST="/etc/nginx/conf.d-stream/frosty-443-stream.conf"
ENV_FILE="${ENV_FILE:-/opt/frostyvpn/backend/.env}"

echo "==> 1. nginx stream 443 (SNI split)"
cp "$STREAM_SRC" "$STREAM_DST"
# убрать .disabled если остался дубликат
rm -f /etc/nginx/conf.d-stream/frosty-443-stream.conf.disabled
nginx -t
systemctl reload nginx

echo "==> 2. xray access log (видеть реальные подключения)"
mkdir -p /var/log/xray
touch /var/log/xray/access.log /var/log/xray/error.log
python3 <<'PY'
import json, sqlite3
p = "/usr/local/x-ui/bin/config.json"
c = json.load(open(p))
c["log"] = {"access": "/var/log/xray/access.log", "error": "/var/log/xray/error.log", "loglevel": "info"}
json.dump(c, open(p, "w"), indent=2)
db = sqlite3.connect("/etc/x-ui/x-ui.db")
for row in db.execute("select id from inbounds where port=10443"):
    db.execute("update inbounds set sniffing=?", (json.dumps({"enabled": False, "destOverride": [], "routeOnly": False}),))
db.commit()
db.close()
PY

echo "==> 3. x-ui inbound port 10443 (не 443)"
python3 <<'PY'
import json, sqlite3
p = "/usr/local/x-ui/bin/config.json"
c = json.load(open(p))
changed = False
for ib in c.get("inbounds", []):
    if ib.get("protocol") == "vless" and ib.get("port") != 10443:
        print(f"fix inbound port {ib.get('port')} -> 10443")
        ib["port"] = 10443
        changed = True
if changed:
    json.dump(c, open(p, "w"), indent=2)
db = sqlite3.connect("/etc/x-ui/x-ui.db")
row = db.execute("select id,port from inbounds where protocol='vless'").fetchone()
if row and row[1] != 10443:
    db.execute("update inbounds set port=10443 where id=?", (row[0],))
    db.commit()
    print("x-ui db port -> 10443")
db.close()
PY
x-ui restart
sleep 4

echo "==> 4. .env XRAY_CLIENT_PORT=10443"
if grep -q '^XRAY_CLIENT_PORT=' "$ENV_FILE"; then
  sed -i 's/^XRAY_CLIENT_PORT=.*/XRAY_CLIENT_PORT=10443/' "$ENV_FILE"
else
  echo 'XRAY_CLIENT_PORT=10443' >> "$ENV_FILE"
fi

echo "==> 5. listeners (nginx:443=klod, xray:10443=VPN)"
ss -tlnp | grep -E ':443 |:10443|:18443' || true

echo "==> 5. smoke: microsoft SNI -> xray cert"
echo | openssl s_client -connect 127.0.0.1:443 -servername www.microsoft.com 2>/dev/null | openssl x509 -noout -subject 2>/dev/null || true

echo "OK: port separation applied"
