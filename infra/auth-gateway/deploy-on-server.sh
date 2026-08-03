#!/bin/bash
set -euo pipefail
umask 077

if [[ ! -f /etc/picom/auth-gateway.env ]]; then
  url=$(grep -E '^SUPABASE_URL=' /etc/picom/email-worker.env | head -1 | cut -d= -f2-)
  key=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' /etc/picom/email-worker.env | head -1 | cut -d= -f2-)
  cat > /etc/picom/auth-gateway.env <<ENV
SUPABASE_URL=${url}
SUPABASE_SERVICE_ROLE_KEY=${key}
ACCOUNT_CENTER_URL=https://account.picom.gg
AUTH_GATEWAY_PORT=4180
ENV
  chmod 600 /etc/picom/auth-gateway.env
fi

echo "auth-gateway.env keys:"
grep -E '^[A-Z0-9_]+=' /etc/picom/auth-gateway.env | cut -d= -f1

cd /opt/picom/infra/auth-gateway
docker compose -f docker-compose.auth-gateway.yml build
docker compose -f docker-compose.auth-gateway.yml up -d
sleep 2
curl -sS -H 'Host: auth.picom.gg' http://127.0.0.1:4180/health || true
echo
docker ps --filter name=picom-auth-gateway --format '{{.Names}} {{.Status}}'

# Install nginx site when TLS cert already exists; otherwise leave ready under /opt.
if [[ -f /etc/letsencrypt/live/auth.picom.gg/fullchain.pem ]]; then
  cp /opt/picom/infra/nginx/auth.picom.gg.conf /etc/nginx/sites-available/auth.picom.gg
  # Ensure redacted log format exists
  if ! grep -q 'picom_auth_redacted' /etc/nginx/nginx.conf; then
    echo "NOTE: add log_format picom_auth_redacted + limit_req_zone picom_auth to http{} then reload"
  fi
  ln -sfn /etc/nginx/sites-available/auth.picom.gg /etc/nginx/sites-enabled/auth.picom.gg
  nginx -t && systemctl reload nginx
  echo "nginx auth.picom.gg enabled"
else
  echo "TLS cert for auth.picom.gg missing — add DNS A→23.254.166.240 then: certbot certonly --nginx -d auth.picom.gg"
fi
