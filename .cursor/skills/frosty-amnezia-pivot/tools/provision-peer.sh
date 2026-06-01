#!/usr/bin/env bash
# Создать AmneziaWG peer и вывести пути к артефактам (запуск на VPS от root).
# Usage: provision-peer.sh <peer_name>
# Example: provision-peer.sh tg_231115635
set -euo pipefail

NAME="${1:?peer name required}"
AWG_DIR="${AMNEZIA_AWG_DIR:-/root/awg}"
SCRIPT="${AMNEZIA_MANAGE_SCRIPT:-$AWG_DIR/manage_amneziawg.sh}"

if [[ ! -x "$SCRIPT" ]]; then
  echo "ERROR: manage script not found: $SCRIPT" >&2
  exit 1
fi

cd "$AWG_DIR"
if [[ -f "$AWG_DIR/${NAME}.conf" ]]; then
  echo "Peer $NAME already exists — skip add"
else
  "$SCRIPT" add "$NAME"
fi

for ext in conf vpnuri png vpnuri.png; do
  f="$AWG_DIR/${NAME}.${ext}"
  [[ -f "$f" ]] && echo "$f"
done
