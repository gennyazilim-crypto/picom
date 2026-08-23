#!/bin/bash
set -euo pipefail
umask 077

ENV_FILE=/etc/picom/auth-gateway.env
mkdir -p /etc/picom

if [[ -f "$ENV_FILE" ]] && grep -qE '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE"; then
  echo "REFUSING: $ENV_FILE must not contain SUPABASE_SERVICE_ROLE_KEY (anon/publishable key only)."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  url=$(grep -E '^SUPABASE_URL=' /etc/picom/email-worker.env 2>/dev/null | head -1 | cut -d= -f2- || true)
  key=$(grep -E '^SUPABASE_ANON_KEY=' /etc/picom/email-worker.env 2>/dev/null | head -1 | cut -d= -f2- || true)
  if [[ -z "${url}" || -z "${key}" ]]; then
    echo "MISSING: create $ENV_FILE with SUPABASE_URL and SUPABASE_ANON_KEY (never a service-role key)."
    exit 1
  fi
  cat > "$ENV_FILE" <<ENV
SUPABASE_URL=${url}
SUPABASE_ANON_KEY=${key}
ACCOUNT_CENTER_URL=https://account.picom.gg
AUTH_GATEWAY_PORT=4180
ENV
  chmod 600 "$ENV_FILE"
fi

echo "auth-gateway.env keys:"
grep -E '^[A-Z0-9_]+=' "$ENV_FILE" | cut -d= -f1

cd /opt/picom/infra/auth-gateway
docker compose -f docker-compose.auth-gateway.yml build
docker compose -f docker-compose.auth-gateway.yml up -d
sleep 2
curl -sS -H 'Host: auth.picom.gg' http://127.0.0.1:4180/health || true
echo
docker ps --filter name=picom-auth-gateway --format '{{.Names}} {{.Status}}'

NGINX_SITE_SRC=/opt/picom/infra/nginx/auth.picom.gg.conf
NGINX_SNIPPET_SRC=/opt/picom/infra/nginx/auth.picom.gg.http-snippet.conf
if [[ ! -f "$NGINX_SITE_SRC" ]]; then
  echo "MISSING: $NGINX_SITE_SRC"
  exit 1
fi

if [[ -f /etc/letsencrypt/live/auth.picom.gg/fullchain.pem ]]; then
  if [[ -f "$NGINX_SNIPPET_SRC" ]]; then
    cp "$NGINX_SNIPPET_SRC" /etc/nginx/conf.d/picom-auth-logging.conf
  fi
  cp "$NGINX_SITE_SRC" /etc/nginx/sites-available/auth.picom.gg
  ln -sfn /etc/nginx/sites-available/auth.picom.gg /etc/nginx/sites-enabled/auth.picom.gg
  nginx -t && systemctl reload nginx
  echo "nginx auth.picom.gg enabled"
else
  echo "TLS cert for auth.picom.gg missing — DNS A is 23.254.166.240; after host ingress recovers: certbot certonly --nginx -d auth.picom.gg"
fi
