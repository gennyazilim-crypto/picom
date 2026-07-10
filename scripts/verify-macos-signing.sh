#!/usr/bin/env bash
set -euo pipefail

app_path="${1:-release/mac/Picom.app}"
dmg_path="${2:-}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS signing verification must run on macOS." >&2
  exit 1
fi
if [[ ! -d "$app_path" ]]; then echo "Picom.app was not found at the approved candidate path." >&2; exit 1; fi
if [[ -z "$dmg_path" || ! -f "$dmg_path" ]]; then echo "A final notarized DMG path is required." >&2; exit 1; fi

codesign --verify --deep --strict --verbose=2 "$app_path"
codesign --display --verbose=4 "$app_path"
codesign --display --entitlements :- "$app_path"
spctl --assess --type execute --verbose=4 "$app_path"
xcrun stapler validate "$dmg_path"
echo "PASS: macOS signature, Gatekeeper assessment and staple validation completed."
