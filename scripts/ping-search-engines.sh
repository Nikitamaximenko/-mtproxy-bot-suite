#!/usr/bin/env bash
# Ping Google and Yandex to re-fetch sitemap after blog deploy
set -euo pipefail
SITE="${SITE_URL:-https://frostybot.ru}"
SITEMAP="${SITE}/sitemap.xml"

echo "Pinging sitemap: $SITEMAP"

curl -fsS "https://www.google.com/ping?sitemap=${SITEMAP}" && echo " — Google OK" || echo " — Google ping failed (non-fatal)"
curl -fsS "https://webmaster.yandex.ru/ping?sitemap=${SITEMAP}" && echo " — Yandex OK" || echo " — Yandex ping failed (non-fatal)"

# IndexNow (Bing/Yandex partial support) — key must match public file if configured
INDEXNOW_KEY="${INDEXNOW_KEY:-frostyblog2026index}"
if [[ -f "$(dirname "$0")/../frontend/public/${INDEXNOW_KEY}.txt" ]]; then
  echo "Submitting blog URLs to IndexNow..."
  node "$(dirname "$0")/indexnow-submit.mjs" || true
fi

echo "Done. Also submit manually in Google Search Console and Yandex Webmaster if needed."
