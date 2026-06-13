#!/usr/bin/env bash
# Деплой campaign engine на VPS + smoke test. Запуск с машины разработчика.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-root@138.124.80.97}"
VPS_PASS="${VPS_PASS:-}"
REMOTE_BACKEND="/opt/frostyvpn/backend"
REMOTE_SCRIPTS="/opt/frostyvpn/scripts"

if [[ -z "$VPS_PASS" ]]; then
  echo "Set VPS_PASS env var" >&2
  exit 1
fi

export SSHPASS="$VPS_PASS"
SSH=(sshpass -e ssh -o StrictHostKeyChecking=no)
SCP=(sshpass -e scp -o StrictHostKeyChecking=no)

echo "==> Upload backend"
"${SCP[@]}" "$REPO_ROOT/backend/main.py" "$VPS_HOST:$REMOTE_BACKEND/main.py"
"${SCP[@]}" "$REPO_ROOT/backend/campaign_engine.py" "$VPS_HOST:$REMOTE_BACKEND/campaign_engine.py"

echo "==> Upload test scripts"
"${SSH[@]}" "$VPS_HOST" "mkdir -p $REMOTE_SCRIPTS"
"${SCP[@]}" "$REPO_ROOT/scripts/campaign_cycle_test.py" "$VPS_HOST:$REMOTE_SCRIPTS/"
"${SCP[@]}" "$REPO_ROOT/scripts/test_campaign_engine.py" "$VPS_HOST:$REMOTE_SCRIPTS/"

echo "==> Restart backend"
"${SSH[@]}" "$VPS_HOST" "systemctl restart frostyvpn-backend && sleep 4 && systemctl is-active frostyvpn-backend"

echo "==> On-VPS cycle test"
"${SSH[@]}" "$VPS_HOST" "cd $REMOTE_BACKEND && python3 $REMOTE_SCRIPTS/campaign_cycle_test.py --on-vps"

echo "==> API smoke (admin key from VPS .env)"
"${SSH[@]}" "$VPS_HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
cd /opt/frostyvpn/backend
ADMIN_API_KEY=$(grep -E '^ADMIN_API_KEY=' .env 2>/dev/null | cut -d= -f2- | tr -d "\"'" || true)
export BACKEND_URL="https://138-124-80-97.sslip.io:9443"
export ADMIN_API_KEY
if [[ -n "$ADMIN_API_KEY" ]]; then
  python3 /opt/frostyvpn/scripts/campaign_cycle_test.py --api
else
  echo "SKIP API test: ADMIN_API_KEY not in .env"
fi
REMOTE

echo "==> Public health"
curl -fsS "https://138-124-80-97.sslip.io:9443/health" && echo ""

echo "DONE"
