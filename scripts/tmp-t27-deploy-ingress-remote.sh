#!/bin/bash
set -euo pipefail
DIR=/home/picom/.config/picom/livekit
cd "$DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
cp -a docker-compose.yaml "docker-compose.yaml.bak-t27-$STAMP"
cp -a livekit.yaml "livekit.yaml.bak-t27-$STAMP"
python3 - <<'PY'
import re, stat
from pathlib import Path
dir_path = Path('/home/picom/.config/picom/livekit')
livekit = dir_path / 'livekit.yaml'
compose = dir_path / 'docker-compose.yaml'
ingress_cfg = dir_path / 'ingress.yaml'
text = livekit.read_text()
api_key = api_secret = None
in_keys = False
for raw in text.splitlines():
    line = raw.rstrip()
    if re.match(r'^keys:\s*$', line):
        in_keys = True
        continue
    if in_keys:
        if re.match(r'^\S', line):
            break
        m = re.match(r'^\s+([A-Za-z0-9_-]+)\s*:\s*(.+?)\s*$', line)
        if m:
            api_key, api_secret = m.group(1), m.group(2).strip().strip('"\'')
            break
if not api_key or not api_secret:
    raise SystemExit('FAIL keys')
ingress_cfg.write_text(
    f"api_key: {api_key}\n"
    f"api_secret: {api_secret}\n"
    "ws_url: ws://127.0.0.1:7880\n"
    "redis:\n"
    "  address: 127.0.0.1:6379\n"
    "rtmp_port: 1935\n"
    "whip_port: 8085\n"
    "http_relay_port: 9090\n"
    "logging:\n"
    "  level: info\n"
)
ingress_cfg.chmod(stat.S_IRUSR | stat.S_IWUSR)
need_restart = False
if 'rtmp_base_url' not in text:
    if not text.endswith('\n'):
        text += '\n'
    text += "ingress:\n  rtmp_base_url: rtmp://ingest.picom.gg/live\n  whip_base_url: https://ingest.picom.gg/whip\n"
    livekit.write_text(text)
    need_restart = True
    print('INFO added ingress URLs to livekit.yaml')
else:
    print('INFO livekit.yaml already has ingress URLs')
c = compose.read_text()
if 'picom-livekit-ingress' not in c:
    service = (
        "\n  picom-livekit-ingress:\n"
        "    image: livekit/ingress:v1.4.2\n"
        "    container_name: picom-livekit-ingress\n"
        "    restart: unless-stopped\n"
        "    network_mode: host\n"
        "    security_opt:\n"
        "      - no-new-privileges:true\n"
        "    volumes:\n"
        "      - ./ingress.yaml:/etc/ingress.yaml:ro\n"
        "    command: [\"--config\", \"/etc/ingress.yaml\"]\n"
    )
    if not c.endswith('\n'):
        c += '\n'
    compose.write_text(c + service)
    print('INFO added ingress service')
else:
    print('INFO ingress service exists')
Path('/tmp/t27-need-restart').write_text('1' if need_restart else '0')
print('CONFIG_OK')
PY
NEED=$(cat /tmp/t27-need-restart)
docker compose -f docker-compose.yaml pull picom-livekit-ingress
if [ "$NEED" = 1 ]; then
  docker compose -f docker-compose.yaml up -d picom-livekit
fi
docker compose -f docker-compose.yaml up -d picom-livekit-ingress
docker compose -f docker-compose.yaml ps picom-livekit picom-livekit-redis picom-livekit-ingress || true
ss -lnt | awk '{print $4}' | grep -E '(:|\.)1935$' && echo OK_1935 || echo WARN_1935
if grep -q 'ufmtvqtsklqsmqxefbbs' livekit.yaml; then
  sed -i.bak-t27-webhook-$STAMP 's#https://ufmtvqtsklqsmqxefbbs.supabase.co/functions/v1/livekit-webhook#https://cqnsetsmcduraryemhbi.supabase.co/functions/v1/livekit-webhook#' livekit.yaml
  docker compose -f docker-compose.yaml up -d picom-livekit
  echo WEBHOOK_RETARGETED_PRODUCTION
else
  echo WEBHOOK_ALREADY_OK_OR_OTHER
fi
