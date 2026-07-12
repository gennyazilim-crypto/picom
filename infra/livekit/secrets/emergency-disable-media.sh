#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

secret_dir="${PICOM_LIVEKIT_SECRET_DIR:-/etc/picom-livekit/secrets}"
environment="$(cat "$secret_dir/environment" 2>/dev/null || true)"
[[ "${EUID}" -eq 0 ]] || { echo "Run as root through the incident secret-custodian path." >&2; exit 1; }
[[ "$environment" =~ ^(staging|production)$ ]] || { echo "Environment marker is invalid." >&2; exit 1; }
[[ "${PICOM_EMERGENCY_CONFIRM:-}" == "DISABLE_${environment^^}_VOICE_SCREEN" ]] || { echo "Environment-specific emergency confirmation is required." >&2; exit 1; }
[[ -n "${PICOM_SUPABASE_PROJECT_REF:-}" ]] || { echo "Protected Supabase project reference is required." >&2; exit 1; }
command -v supabase >/dev/null || { echo "Supabase CLI is required." >&2; exit 1; }

temporary="$(mktemp)"
trap 'rm -f "$temporary"' EXIT
chmod 0600 "$temporary"
printf 'PICOM_V1_VOICE_SCREEN_ENABLED=false\n' >"$temporary"
supabase secrets set --project-ref "$PICOM_SUPABASE_PROJECT_REF" --env-file "$temporary" >/dev/null
rm -f "$temporary"
trap - EXIT

if [[ "${PICOM_EMERGENCY_STOP_PROVIDER:-}" == STOP_PROVIDER && -L /opt/picom-livekit/current ]]; then
  current="$(readlink -f /opt/picom-livekit/current)"
  docker compose --project-name picom-livekit --env-file "$current/runtime.env" -f "$current/compose.yaml" stop --timeout 60 livekit >/dev/null
fi
logger -p authpriv.warning -t picom-livekit-incident "Voice/Screen token issuance disabled for protected environment; Feed Chat and DM were not changed"
echo "Voice/Screen token issuance is disabled. Feed, Chat, and DM remain available; no secret was printed."
