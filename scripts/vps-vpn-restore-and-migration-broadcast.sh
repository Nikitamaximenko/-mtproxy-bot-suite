#!/usr/bin/env bash
# Восстановить VPN на VPS (x-ui/xray 443) и разослать «переезд завершён, всё работает».
# Запуск на VPS: VPS_PASS=... bash scripts/vps-vpn-restore-and-migration-broadcast.sh
# Или уже на сервере: bash /opt/frostyvpn/scripts/vps-vpn-restore-and-migration-broadcast.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-root@138.124.80.97}"
VPS_PASS="${VPS_PASS:-}"
RUN_LOCAL="${RUN_LOCAL:-0}"

ssh_retry() {
  local n=0
  until sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=25 "$VPS_HOST" "$@"; do
    n=$((n + 1))
    if [[ $n -ge 8 ]]; then
      echo "SSH failed after 8 attempts — проверьте VPS в панели хостинга (перезагрузка VM)" >&2
      return 1
    fi
    echo "SSH retry $n/8..."
    sleep $((n * 4))
  done
}

run_remote() {
  if [[ "$RUN_LOCAL" == "1" ]]; then
    bash -s
  else
    if [[ -z "$VPS_PASS" ]]; then
      echo "Set VPS_PASS or RUN_LOCAL=1 on the VPS" >&2
      exit 1
    fi
    export SSHPASS="$VPS_PASS"
    ssh_retry 'bash -s'
  fi
}

run_remote <<'REMOTE'
set -euo pipefail
REPO="${REPO:-/opt/frostyvpn}"
ENV_FILE="$REPO/backend/.env"

echo "==> 1. Restart core services"
systemctl restart frostyvpn-backend frostyvpn-bot nginx 2>/dev/null || true
if systemctl list-units --type=service --all | grep -q x-ui; then
  systemctl restart x-ui 2>/dev/null || x-ui restart 2>/dev/null || true
elif command -v x-ui >/dev/null 2>&1; then
  x-ui restart || true
fi
sleep 4

echo "==> 2. Frosty-only on 443 (xray direct)"
if [[ -f "$REPO/scripts/vps-frosty-only-restore.sh" ]]; then
  bash "$REPO/scripts/vps-frosty-only-restore.sh"
else
  echo "WARN: vps-frosty-only-restore.sh missing, skipping"
fi

echo "==> 3. Verify listeners"
ss -tlnp | grep -E ':443 |:9443|:8000' || true

echo "==> 4. Backend health"
curl -fsS http://127.0.0.1:8000/health && echo ""

echo "==> 5. Migration broadcast to all users"
ADMIN_KEY="$(grep -E '^ADMIN_API_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d "\"'" )"
if [[ -z "$ADMIN_KEY" ]]; then
  echo "ERROR: ADMIN_API_KEY missing in $ENV_FILE" >&2
  exit 1
fi
RESP="$(curl -fsS -X POST http://127.0.0.1:8000/admin/broadcast-vpn-migration \
  -H "x-admin-key: $ADMIN_KEY" \
  -H "Content-Type: application/json")"
echo "$RESP"

TOTAL="$(python3 -c "import json,sys; print(json.load(sys.stdin).get('total',0))" <<<"$RESP")"
echo "Queued migration broadcast: $TOTAL recipients"

echo "==> 6. Poll broadcast status (up to 3 min)"
for _ in $(seq 1 36); do
  ST="$(curl -fsS http://127.0.0.1:8000/admin/broadcast-status -H "x-admin-key: $ADMIN_KEY")"
  DONE="$(python3 -c "import json,sys; print(json.load(sys.stdin).get('done',False))" <<<"$ST")"
  SENT="$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('sent',0), d.get('failed',0))" <<<"$ST")"
  echo "  status: done=$DONE sent/fail=$SENT"
  if [[ "$DONE" == "True" || "$DONE" == "true" ]]; then
    break
  fi
  sleep 5
done

echo "DONE: VPN restore + migration broadcast"
REMOTE
