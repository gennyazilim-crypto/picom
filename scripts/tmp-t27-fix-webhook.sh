#!/bin/bash
set -euo pipefail
cd /home/picom/.config/picom/livekit
cp -a livekit.yaml livekit.yaml.bak-t27-webhook-final
python3 - <<'PY'
from pathlib import Path
p = Path('livekit.yaml')
t = p.read_text()
old = 'https://ufmtvqtsklqsmqxefbbs.supabase.co/functions/v1/livekit-webhook'
new = 'https://cqnsetsmcduraryemhbi.supabase.co/functions/v1/livekit-webhook'
t2 = t.replace(old, new)
p.write_text(t2)
print('CHANGED' if t != t2 else 'SAME')
PY
docker compose -f docker-compose.yaml up -d --force-recreate livekit
sleep 3
grep -n webhook -A2 livekit.yaml | head -5
docker ps --filter name=picom-livekit --format '{{.Names}} {{.Status}}'
ss -lnt | grep 1935 || true
