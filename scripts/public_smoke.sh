#!/usr/bin/env bash
# Публичные смоук-тесты бэкенда без секретов (health, subscription, защита admin).
# Использование: BASE_URL=https://xxx.up.railway.app ./scripts/public_smoke.sh
set -euo pipefail
BASE="${BASE_URL:-https://mtproxy-bot-suite-production.up.railway.app}"
BASE="${BASE%/}"

echo "== $BASE/health =="
curl -sS --max-time 20 "$BASE/health" && echo

echo "== $BASE/subscription/999999001 (ожидаем active:false) =="
curl -sS --max-time 20 "$BASE/subscription/999999001" && echo

echo "== $BASE/admin/stats (ожидаем 403 без ключа) =="
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "$BASE/admin/stats" || echo "err")
echo "http $code"

echo "== $BASE/vpn/config/1 без токена (ожидаем 200 + internal_token_required если токен задан на бэкенде) =="
curl -sS --max-time 20 "$BASE/vpn/config/1" && echo

echo "OK"
