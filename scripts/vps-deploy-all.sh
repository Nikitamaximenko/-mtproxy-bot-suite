#!/usr/bin/env bash
# Полный деплой на VPS: git pull, backend+bot, OpenRouter, smoke tests.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS_HOST="${VPS_HOST:-root@138.124.80.97}"
VPS_PASS="${VPS_PASS:-}"
PUBLIC_BACKEND="${PUBLIC_BACKEND:-https://138-124-80-97.sslip.io:9443}"

if [[ -z "$VPS_PASS" ]]; then
  echo "Set VPS_PASS env var" >&2
  exit 1
fi

export SSHPASS="$VPS_PASS"
SSH=(sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=25)
SCP=(sshpass -e scp -o StrictHostKeyChecking=no -o ConnectTimeout=25)

ssh_retry() {
  local n=0
  until "${SSH[@]}" "$VPS_HOST" "$@"; do
    n=$((n + 1))
    if [[ $n -ge 5 ]]; then
      echo "SSH failed after 5 attempts" >&2
      return 1
    fi
    echo "SSH retry $n/5..."
    sleep $((n * 3))
  done
}

echo "==> Sync repo on VPS (git pull)"
ssh_retry "cd /opt/frostyvpn && git fetch origin main && git reset --hard origin/main"

echo "==> Copy OPENROUTER from bot .env to backend .env (if missing)"
ssh_retry 'bash -s' <<'REMOTE'
set -euo pipefail
BE=/opt/frostyvpn/backend/.env
BO=/opt/frostyvpn/bot/.env
if [[ -f "$BO" ]]; then
  for key in OPENROUTER_API_KEY OPENROUTER_HTTP_REFERER OPENROUTER_APP_NAME; do
    if ! grep -q "^${key}=" "$BE" 2>/dev/null; then
      val=$(grep -E "^${key}=" "$BO" | head -1 || true)
      if [[ -n "$val" ]]; then
        echo "$val" >> "$BE"
        echo "  added $key to backend .env"
      fi
    fi
  done
  INF="/opt/frostyvpn/bot/.openrouter_inference_key"
  if [[ -f "$INF" ]]; then
    ik=$(tr -d "\n" < "$INF")
    if [[ -n "$ik" ]]; then
      if grep -q "^OPENROUTER_API_KEY=" "$BE"; then
        sed -i "s|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=${ik}|" "$BE"
      else
        echo "OPENROUTER_API_KEY=${ik}" >> "$BE"
      fi
      echo "  synced inference OPENROUTER_API_KEY from bot cache"
    fi
  fi
fi
REMOTE

echo "==> Install Python deps"
ssh_retry "/opt/frostyvpn/.venv/bin/pip install -q -r /opt/frostyvpn/backend/requirements.txt -r /opt/frostyvpn/bot/requirements.txt"

echo "==> Restart services"
ssh_retry "systemctl restart frostyvpn-backend frostyvpn-bot && sleep 5 && systemctl is-active frostyvpn-backend && systemctl is-active frostyvpn-bot"

echo "==> On-VPS campaign tests"
ssh_retry "/opt/frostyvpn/.venv/bin/python /opt/frostyvpn/scripts/campaign_cycle_test.py --on-vps"

echo "==> API smoke"
ssh_retry 'bash -s' <<REMOTE
set -euo pipefail
cd /opt/frostyvpn/backend
ADMIN_API_KEY=\$(grep -E '^ADMIN_API_KEY=' .env | cut -d= -f2- | tr -d "\"'")
export BACKEND_URL="$PUBLIC_BACKEND"
export ADMIN_API_KEY
/opt/frostyvpn/.venv/bin/python /opt/frostyvpn/scripts/campaign_cycle_test.py --api
REMOTE

echo "==> Public health"
curl -fsS "$PUBLIC_BACKEND/health" && echo ""

echo "==> Vercel proxy smoke"
ADMIN_KEY=$("${SSH[@]}" "$VPS_HOST" "grep -E '^ADMIN_API_KEY=' /opt/frostyvpn/backend/.env | cut -d= -f2- | tr -d \"\\\"'\"'" 2>/dev/null | tail -1 || true)
if [[ -n "$ADMIN_KEY" ]]; then
  code=$(curl -sS -o /dev/null -w "%{http_code}" "https://frostybot.ru/api/admin/campaigns" -H "x-admin-key: $ADMIN_KEY")
  echo "frostybot.ru/api/admin/campaigns -> HTTP $code"
fi

echo "DONE"
