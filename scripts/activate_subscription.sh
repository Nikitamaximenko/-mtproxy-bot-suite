#!/bin/bash
# Activate subscription for a user (admin helper)
# Usage: ADMIN_API_KEY=your_key ./scripts/activate_subscription.sh [telegram_id]
# Example: ADMIN_API_KEY=secret ./scripts/activate_subscription.sh 231115635

TG_ID="${1:-231115635}"
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"

if [ -z "$ADMIN_API_KEY" ]; then
  echo "Set ADMIN_API_KEY env var. Example:"
  echo "  ADMIN_API_KEY=your_key ./scripts/activate_subscription.sh $TG_ID"
  exit 1
fi

curl -s -X POST "$BACKEND_URL/admin/activate/$TG_ID" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

echo ""
