#!/usr/bin/env bash
# Локальная проверка: бэкенд + БД + цепочка как у мини-аппа (через Next /api/checkout).
# Запуск: из корня репозитория, после старта uvicorn и next dev с BACKEND_URL.
#
# Терминал 1:
#   cd backend && DATABASE_URL=sqlite:///./e2e.db LAVA_TOP_OFFER_ID=11111111-1111-1111-1111-111111111111 \
#     .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8002
# Терминал 2:
#   cd frontend && BACKEND_URL=http://127.0.0.1:8002 pnpm exec next dev -p 3005
# Терминал 3:
#   ./scripts/e2e_payment_check.sh

set -euo pipefail
BASE="${NEXT_URL:-http://127.0.0.1:3005}"
TG=888001

echo "== GET /api/subscription (ожидаем active:false) =="
curl -s "$BASE/api/subscription?tg_id=$TG" | jq . 2>/dev/null || curl -s "$BASE/api/subscription?tg_id=$TG"

echo ""
echo "== POST /api/checkout (ожидаем payment_url) =="
curl -s -X POST "$BASE/api/checkout" \
  -H "Content-Type: application/json" \
  -d "{\"telegram_id\":\"$TG\",\"email\":\"e2e@example.com\"}" | jq . 2>/dev/null || curl -s -X POST "$BASE/api/checkout" \
  -H "Content-Type: application/json" \
  -d "{\"telegram_id\":\"$TG\",\"email\":\"e2e@example.com\"}"

echo ""
echo "OK — если есть payment_url и subscription отвечает JSON, фронт ↔ бэк ↔ БД работают."
