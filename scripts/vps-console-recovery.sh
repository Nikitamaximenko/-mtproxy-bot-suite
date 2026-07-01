#!/usr/bin/env bash
# Аварийное восстановление Frosty на VPS — вставить в VNC/Console панели ptr.tech
# (Сервер → frosty-finland → Console / VNC), войти как root.
#
# Если SSH снаружи не открывается, но консоль в панели работает — скопируйте
# целиком и вставьте в терминал консоли.
set -euxo pipefail

REPO="${REPO:-/opt/frostyvpn}"
ENV_FILE="$REPO/backend/.env"

echo "==> Frosty emergency recovery $(date -Is)"

echo "==> Network recovery"
ip addr show || true
ip route || true
systemctl restart systemd-networkd 2>/dev/null || true
systemctl restart networking 2>/dev/null || true
systemctl restart NetworkManager 2>/dev/null || true
dhclient -4 -v 2>/dev/null || true
netplan apply 2>/dev/null || true

echo "==> SSH + firewall recovery"
systemctl enable ssh 2>/dev/null || systemctl enable sshd 2>/dev/null || true
systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true
ufw --force disable 2>/dev/null || true
iptables -P INPUT ACCEPT 2>/dev/null || true
iptables -P FORWARD ACCEPT 2>/dev/null || true
iptables -P OUTPUT ACCEPT 2>/dev/null || true
iptables -F 2>/dev/null || true
ip6tables -P INPUT ACCEPT 2>/dev/null || true
ip6tables -P FORWARD ACCEPT 2>/dev/null || true
ip6tables -P OUTPUT ACCEPT 2>/dev/null || true
ip6tables -F 2>/dev/null || true

echo "==> Core services"
systemctl enable frostyvpn-backend frostyvpn-bot nginx 2>/dev/null || true
systemctl restart frostyvpn-backend frostyvpn-bot nginx 2>/dev/null || true
if systemctl list-units --type=service --all | grep -q x-ui; then
  systemctl restart x-ui 2>/dev/null || true
elif command -v x-ui >/dev/null 2>&1; then
  x-ui restart || true
fi
sleep 5

echo "==> xray on 443"
if [[ -f "$REPO/scripts/vps-frosty-only-restore.sh" ]]; then
  bash "$REPO/scripts/vps-frosty-only-restore.sh"
else
  echo "WARN: $REPO/scripts/vps-frosty-only-restore.sh not found"
fi

echo "==> Listeners"
ss -tlnp | grep -E ':443|:22|:8000|:9443' || true
echo "==> External reachability hint"
curl -4 -sS -m 5 ifconfig.me || true
echo ""

echo "==> Local health"
curl -fsS http://127.0.0.1:8000/health && echo ""

echo "==> Migration broadcast (VPN снова работает)"
ADMIN_KEY="$(grep -E '^ADMIN_API_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d "\"'" )"
if [[ -z "$ADMIN_KEY" ]]; then
  echo "ERROR: ADMIN_API_KEY not in $ENV_FILE"
  exit 1
fi
curl -fsS -X POST http://127.0.0.1:8000/admin/broadcast-vpn-migration \
  -H "x-admin-key: $ADMIN_KEY" \
  -H "Content-Type: application/json"
echo ""

echo "==> Poll broadcast (2 min max)"
for _ in $(seq 1 24); do
  ST="$(curl -fsS http://127.0.0.1:8000/admin/broadcast-status -H "x-admin-key: $ADMIN_KEY")"
  echo "$ST"
  echo "$ST" | grep -q '"done": true' && break
  echo "$ST" | grep -q '"done":true' && break
  sleep 5
done

echo "DONE. Check: curl -k https://138-124-80-97.sslip.io:9443/health"
