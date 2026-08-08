#!/usr/bin/env bash
set -euo pipefail
CFG=/home/picom/.config/picom/livekit/livekit.yaml
cd /home/picom/.config/picom/livekit

# ingest.picom.gg DNS is not published yet; use VPS public IP for RTMP base.
# Plain RTMP on :1935 only (UFW allow); admin/API ports remain closed.
if grep -q 'rtmp_base_url: rtmp://ingest.picom.gg/live' "$CFG"; then
  sed -i 's|rtmp_base_url: rtmp://ingest.picom.gg/live|rtmp_base_url: rtmp://23.254.166.240/live|' "$CFG"
  echo UPDATED_RTMP_BASE_TO_IP
elif grep -q 'rtmp_base_url: rtmp://23.254.166.240/live' "$CFG"; then
  echo RTMP_BASE_ALREADY_IP
else
  echo RTMP_BASE_UNEXPECTED
  grep -n 'rtmp_base\|whip_base' "$CFG" || true
fi

# WHIP hostname without DNS will break clients; leave documented but prefer IP if present.
if grep -q 'whip_base_url: https://ingest.picom.gg/whip' "$CFG"; then
  sed -i 's|whip_base_url: https://ingest.picom.gg/whip|whip_base_url: http://23.254.166.240:8085/whip|' "$CFG"
  echo UPDATED_WHIP_BASE_TO_IP
fi

docker compose up -d --force-recreate livekit
sleep 2
docker ps --format '{{.Names}} {{.Status}}' | grep livekit
echo '---CONFIG---'
grep -E 'rtmp_base|whip_base|webhook' -A3 "$CFG" | head -25
echo '---PORTS---'
ss -lntp | grep -E '1935|8085|7880' || true
