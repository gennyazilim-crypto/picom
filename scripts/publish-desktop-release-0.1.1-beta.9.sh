#!/usr/bin/env bash
# Publish Picom Desktop 0.1.1-beta.9 download feed + patch marketing download links.
# Run on picom-update-server as root. Idempotent where safe.
set -euo pipefail

VERSION="0.1.1-beta.9"
PREV="0.1.1-beta.8"
INSTALLER="Picom-${VERSION}-beta-Windows-x64.exe"
BLOCKMAP="${INSTALLER}.blockmap"
SHA256_EXPECTED="6c7cfcc1fc38f8f208a666bb4dac4a78d8bf8ef13a50120f7cca9c90d07362ff"
SIZE_EXPECTED="123315761"
PUBLISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

WWW="/var/www/picom.gg"
DL="${WWW}/downloads/windows"
VER_DIR="${DL}/${VERSION}"
BACKUP_ROOT="/var/backups/picom/web"
BACKUP_TAR="${BACKUP_ROOT}/picom.gg-download-publish-${STAMP}.tar.gz"
STAGE="/var/www/.deploy/picom-release-${VERSION}-${STAMP}"

echo "== preflight =="
test -f "${DL}/${INSTALLER}"
test -f "${DL}/${BLOCKMAP}"
test -f "${DL}/beta.yml"
ACTUAL_SHA="$(sha256sum "${DL}/${INSTALLER}" | awk '{print $1}')"
ACTUAL_SIZE="$(stat -c '%s' "${DL}/${INSTALLER}")"
echo "sha256=${ACTUAL_SHA}"
echo "size=${ACTUAL_SIZE}"
test "${ACTUAL_SHA}" = "${SHA256_EXPECTED}"
test "${ACTUAL_SIZE}" = "${SIZE_EXPECTED}"

echo "== backup =="
mkdir -p "${BACKUP_ROOT}" "${STAGE}"
tar -czf "${BACKUP_TAR}" \
  -C /var/www \
  picom.gg/download.html \
  picom.gg/en/download.html \
  picom.gg/tr/download.html \
  picom.gg/downloads \
  || true
# Broader HTML backup of pages containing previous installer name (may be large but safe)
find "${WWW}" -type f -name '*.html' -print0 \
  | xargs -0 grep -l "Picom-${PREV}-beta-Windows-x64.exe" 2>/dev/null \
  | tar -czf "${BACKUP_ROOT}/picom.gg-html-beta8-refs-${STAMP}.tar.gz" -T - \
  || true
test -s "${BACKUP_TAR}"
ls -la "${BACKUP_TAR}" "${BACKUP_ROOT}/picom.gg-html-beta8-refs-${STAMP}.tar.gz" 2>/dev/null || true

echo "== immutable version dir =="
mkdir -p "${VER_DIR}.new"
install -m 644 "${DL}/${INSTALLER}" "${VER_DIR}.new/${INSTALLER}"
install -m 644 "${DL}/${BLOCKMAP}" "${VER_DIR}.new/${BLOCKMAP}"
install -m 644 "${DL}/beta.yml" "${VER_DIR}.new/beta.yml"
printf '%s  %s\n' "${SHA256_EXPECTED}" "${INSTALLER}" > "${VER_DIR}.new/${INSTALLER}.sha256"
chmod 644 "${VER_DIR}.new/${INSTALLER}.sha256"
# Promote version dir atomically
rm -rf "${VER_DIR}.old"
if [[ -d "${VER_DIR}" ]]; then mv "${VER_DIR}" "${VER_DIR}.old"; fi
mv "${VER_DIR}.new" "${VER_DIR}"
# Also keep flat sha256 next to feed root
install -m 644 "${VER_DIR}/${INSTALLER}.sha256" "${DL}/${INSTALLER}.sha256"

echo "== latest.yml / latest.json / beta.yml already points to ${VERSION} =="
# Promote beta.yml contents to latest.yml (stable feed currently tracks latest beta)
install -m 644 "${DL}/beta.yml" "${DL}/latest.yml.next"
mv "${DL}/latest.yml.next" "${DL}/latest.yml"

python3 - <<PY
import json
from pathlib import Path
manifest = {
  "product": "PICOM Desktop",
  "channel": "beta",
  "latestVersion": "${VERSION}",
  "publishedAt": "${PUBLISHED_AT}",
  "platforms": {
    "windows": {
      "available": True,
      "architecture": ["x64"],
      "installerType": "exe",
      "fileName": "${INSTALLER}",
      "url": "https://picom.gg/downloads/windows/latest/${INSTALLER}",
      "directUrl": "https://picom.gg/downloads/windows/${INSTALLER}",
      "versionedUrl": "https://picom.gg/downloads/windows/releases/${VERSION}/${INSTALLER}",
      "sizeBytes": int("${SIZE_EXPECTED}"),
      "sha256": "${SHA256_EXPECTED}",
      "signed": False,
      "minimumOs": "Windows 10"
    },
    "macos": {"available": False},
    "linux": {"available": False}
  },
  "releaseNotesUrl": "https://picom.gg/en/changelog"
}
Path("${DL}/latest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
Path("${WWW}/downloads/releases.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
# Convenience alias path used by some docs
releases = Path("${DL}/releases")
releases.mkdir(parents=True, exist_ok=True)
# Symlink version into releases/<version> if missing
target = Path("${VER_DIR}")
link = releases / "${VERSION}"
if link.exists() or link.is_symlink():
    link.unlink()
link.symlink_to(target)
print("wrote manifests")
PY
chmod 644 "${DL}/latest.json" "${WWW}/downloads/releases.json"

echo "== switch latest symlink =="
# latest must be a directory containing the versioned installer filename
ln -sfn "${VERSION}" "${DL}/latest.new"
# Atomic-ish replace of symlink
mv -Tf "${DL}/latest.new" "${DL}/latest"
ls -la "${DL}/latest"
test -f "${DL}/latest/${INSTALLER}"

echo "== patch marketing HTML download URLs =="
# Replace installer filename and common version display strings across locale HTML
python3 - <<'PY'
from pathlib import Path
import re

root = Path("/var/www/picom.gg")
old_exe = "Picom-0.1.1-beta.8-beta-Windows-x64.exe"
new_exe = "Picom-0.1.1-beta.9-beta-Windows-x64.exe"
replacements = [
    (old_exe, new_exe),
    ("v0.1.1-beta.8 · 2026-07-25", "v0.1.1-beta.9 · 2026-07-26"),
    ("v0.1.1-beta.8 · 2026-07-25", "v0.1.1-beta.9 · 2026-07-26"),
    ("0.1.1-beta.8 · 2026-07-25", "0.1.1-beta.9 · 2026-07-26"),
]
# Also catch bare version in downloadHref JSON props without rewriting unrelated changelog text aggressively:
# only replace when adjacent to installer path or downloadHref
changed = 0
scanned = 0
for path in root.rglob("*.html"):
    scanned += 1
    text = path.read_text(encoding="utf-8", errors="surrogateescape")
    original = text
    if old_exe not in text and "v0.1.1-beta.8 · 2026-07-25" not in text:
        continue
    for a, b in replacements:
        text = text.replace(a, b)
    # Fix downloadHref JSON if it still embeds beta.8 version token next to windows/latest
    text = text.replace(
        "windows/latest/Picom-0.1.1-beta.8",
        "windows/latest/Picom-0.1.1-beta.9",
    )
    if text != original:
        path.write_text(text, encoding="utf-8", errors="surrogateescape")
        changed += 1
print(f"scanned={scanned} changed={changed}")
# Verify residual direct installer refs
residual = []
for path in root.rglob("*.html"):
    t = path.read_text(encoding="utf-8", errors="ignore")
    if old_exe in t:
        residual.append(str(path))
print(f"residual_old_exe={len(residual)}")
if residual[:10]:
    print("\n".join(residual[:10]))
if residual:
    raise SystemExit("Old installer filename still present in HTML")
PY

echo "== permissions =="
chown -R www-data:www-data "${DL}/${VERSION}" "${DL}/latest.json" "${DL}/latest.yml" "${DL}/${INSTALLER}.sha256" "${WWW}/downloads/releases.json" || true
find "${DL}/${VERSION}" -type d -exec chmod 755 {} \;
find "${DL}/${VERSION}" -type f -exec chmod 644 {} \;
chmod 644 "${DL}/latest.yml" "${DL}/beta.yml" "${DL}/latest.json" "${WWW}/downloads/releases.json"

echo "== nginx =="
nginx -t
systemctl reload nginx

echo "== verify =="
test -f "${DL}/latest/${INSTALLER}"
test "$(readlink -f "${DL}/latest")" = "$(readlink -f "${VER_DIR}")"
sha256sum "${DL}/latest/${INSTALLER}"
head -5 "${DL}/latest.yml"
python3 - <<PY
import json
from pathlib import Path
m=json.loads(Path("/var/www/picom.gg/downloads/releases.json").read_text())
assert m["latestVersion"]=="${VERSION}"
assert m["platforms"]["windows"]["sha256"]=="${SHA256_EXPECTED}"
print("manifest ok", m["platforms"]["windows"]["url"])
PY

echo "DONE ${VERSION} backup=${BACKUP_TAR}"
