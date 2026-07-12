#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

phase="${1:-}"
secret_dir="${PICOM_LIVEKIT_SECRET_DIR:-/etc/picom-livekit/secrets}"
rotation_root="${PICOM_ROTATION_ROOT:-/etc/picom-livekit/rotations}"
environment="$(cat "$secret_dir/environment" 2>/dev/null || true)"
rotation_id="${PICOM_ROTATION_ID:-}"
state_dir="$rotation_root/$rotation_id"
config="$secret_dir/livekit.yaml"
network_env="${PICOM_NETWORK_ENV:-/etc/picom-livekit/network.env}"

[[ "${EUID}" -eq 0 ]] || { echo "Run as root through the approved secret-custodian path." >&2; exit 1; }
[[ "$phase" =~ ^(prepare|finalize|rollback)$ ]] || { echo "Usage: rotate-livekit-api-key.sh <prepare|finalize|rollback>." >&2; exit 1; }
[[ "$environment" =~ ^(staging|production)$ ]] || { echo "Environment marker is invalid." >&2; exit 1; }
expected_confirm="$( [[ "$environment" == staging ]] && echo ROTATE_STAGING || echo ROTATE_PRODUCTION )"
[[ "${PICOM_ROTATION_CONFIRM:-}" == "$expected_confirm" ]] || { echo "Environment-specific rotation confirmation is required." >&2; exit 1; }
[[ "$rotation_id" =~ ^[A-Za-z0-9._-]{8,80}$ ]] || { echo "PICOM_ROTATION_ID is required and invalid." >&2; exit 1; }
[[ -f "$config" && "$(stat -c '%U:%G:%a' "$config")" == root:picom-livekit:640 ]] || { echo "LiveKit secret config boundary is invalid." >&2; exit 1; }
[[ -f "$network_env" ]] || { echo "Protected network environment is missing." >&2; exit 1; }
# shellcheck disable=SC1090
source "$network_env"
[[ -n "${PICOM_PRIMARY_HOSTNAME:-}" && -n "${PICOM_SUPABASE_PROJECT_REF:-}" ]] || { echo "Protected endpoint/project metadata is incomplete." >&2; exit 1; }
command -v supabase >/dev/null || { echo "Supabase CLI is required on the protected operator host." >&2; exit 1; }

current_release="$(readlink -f /opt/picom-livekit/current 2>/dev/null || true)"
restart_and_check() {
  [[ -f "$current_release/compose.yaml" && -f "$current_release/runtime.env" ]] || { echo "Current Compose release is unavailable." >&2; exit 1; }
  docker compose --project-name picom-livekit --env-file "$current_release/runtime.env" -f "$current_release/compose.yaml" restart --timeout 60 livekit >/dev/null
  PICOM_COMPOSE_FILE="$current_release/compose.yaml" PICOM_LIVEKIT_SECRET_DIR="$secret_dir" "$(cd "$(dirname "${BASH_SOURCE[0]}")/../compose" && pwd)/status-staging.sh" >/dev/null
}
set_edge_secrets() {
  key="$1" secret="$2" enabled="$3"
  env_file="$(mktemp "$state_dir/edge-secrets.XXXXXX")"
  trap 'rm -f "${env_file:-}"' RETURN
  printf 'LIVEKIT_URL=wss://%s\nLIVEKIT_API_KEY=%s\nLIVEKIT_API_SECRET=%s\nPICOM_V1_VOICE_SCREEN_ENABLED=%s\n' "$PICOM_PRIMARY_HOSTNAME" "$key" "$secret" "$enabled" >"$env_file"
  chmod 0600 "$env_file"
  supabase secrets set --project-ref "$PICOM_SUPABASE_PROJECT_REF" --env-file "$env_file" >/dev/null
  rm -f "$env_file"
  trap - RETURN
}

if [[ "$phase" == prepare ]]; then
  [[ ! -e "$state_dir" ]] || { echo "Rotation ID already exists." >&2; exit 1; }
  install -o root -g root -m 0700 -d "$state_dir"
  install -o root -g root -m 0600 "$config" "$state_dir/livekit.before.yaml"
  new_key="PIC$(openssl rand -hex 12)"
  new_secret="$(openssl rand -hex 32)"
  python3 - "$config" "$state_dir/state.json" "$environment" "$new_key" "$new_secret" <<'PY'
from pathlib import Path
import json, re, sys
config, state, environment, new_key, new_secret = map(Path, sys.argv[1:2]) if False else sys.argv[1:]
path = Path(config)
text = path.read_text()
match = re.search(r"(?ms)^keys:\n((?:  \"[^\"]+\": \"[^\"]+\"\n?)+)", text)
if not match:
    raise SystemExit("Approved LiveKit keys block was not found")
old_keys = re.findall(r'^  "([^"]+)":', match.group(1), re.M)
addition = f'  "{new_key}": "{new_secret}"\n'
path.write_text(text[:match.end(1)] + ("\n" if not match.group(1).endswith("\n") else "") + addition + text[match.end(1):])
Path(state).write_text(json.dumps({"environment": environment, "phase": "overlap", "oldKeys": old_keys, "newKey": new_key}, indent=2) + "\n")
PY
  chown root:picom-livekit "$config"
  chmod 0640 "$config"
  chmod 0600 "$state_dir/state.json"
  restart_and_check
  set_edge_secrets "$new_key" "$new_secret" true
  unset new_key new_secret
  echo "Overlapping LiveKit key rotation prepared. Run real member Voice/Screen validation before finalize; no key was printed."
elif [[ "$phase" == finalize ]]; then
  [[ "${PICOM_ROTATION_VALIDATION_EVIDENCE:-}" == PASSED ]] || { echo "Real member Voice/Screen rotation evidence must equal PASSED." >&2; exit 1; }
  [[ -f "$state_dir/state.json" ]] || { echo "Rotation state is missing." >&2; exit 1; }
  python3 - "$config" "$state_dir/state.json" <<'PY'
from pathlib import Path
import json, re, sys
path, state_path = map(Path, sys.argv[1:])
state = json.loads(state_path.read_text())
if state.get("phase") != "overlap": raise SystemExit("Rotation is not in overlap phase")
text = path.read_text()
for key in state["oldKeys"]:
    text = re.sub(rf'^  "{re.escape(key)}": "[^"]+"\n?', '', text, flags=re.M)
path.write_text(text)
state["phase"] = "finalized"
state_path.write_text(json.dumps(state, indent=2) + "\n")
PY
  chown root:picom-livekit "$config"
  chmod 0640 "$config" "$state_dir/state.json"
  restart_and_check
  echo "Old LiveKit keys revoked after explicit validation evidence; no key was printed."
else
  [[ -f "$state_dir/livekit.before.yaml" ]] || { echo "Rotation rollback snapshot is missing." >&2; exit 1; }
  [[ "${PICOM_ROTATION_INCIDENT_MODE:-}" != COMPROMISED_KEY ]] || { echo "Rollback to a compromised key is forbidden; perform a fresh emergency rotation." >&2; exit 1; }
  install -o root -g picom-livekit -m 0640 "$state_dir/livekit.before.yaml" "$config"
  read -r old_key old_secret < <(python3 - "$config" <<'PY'
from pathlib import Path
import re, sys
m = re.search(r'(?m)^  "([^"]+)": "([^"]+)"$', Path(sys.argv[1]).read_text())
if not m: raise SystemExit("Rollback key is unavailable")
print(m.group(1), m.group(2))
PY
)
  restart_and_check
  set_edge_secrets "$old_key" "$old_secret" true
  unset old_key old_secret
  echo "Rotation rolled back to the protected pre-rotation snapshot; no key was printed."
fi
