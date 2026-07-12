#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

[[ "${EUID}" -eq 0 ]] || { echo "Run as root through the approved deployment path." >&2; exit 1; }
[[ "${PICOM_STOP_CONFIRM:-}" == "STAGING_ONLY" ]] || { echo "Set PICOM_STOP_CONFIRM=STAGING_ONLY." >&2; exit 1; }
current="$(readlink -f /opt/picom-livekit/current 2>/dev/null || true)"
[[ -f "$current/compose.yaml" && -f "$current/runtime.env" ]] || { echo "Current staging release is unavailable." >&2; exit 1; }
docker compose --project-name picom-livekit --env-file "$current/runtime.env" -f "$current/compose.yaml" down --timeout 60
echo "Staging LiveKit/Redis stopped gracefully; Redis volume and secret files were preserved."
