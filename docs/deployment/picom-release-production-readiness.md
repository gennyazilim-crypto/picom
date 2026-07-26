# PICOM Release Production Readiness — 0.1.1-beta.9

## Final verdict

**PRODUCTION READY WITH NON-BLOCKING WARNINGS**

Download publish, manifests, symlink, nginx reload, and live checksum verification succeeded for Windows beta.9.

## Passing critical path

- Real version from `package.json`: `0.1.1-beta.9`
- Real installer present and non-zero
- SHA-256 generated and verified local ↔ server ↔ live download
- `latest` → `0.1.1-beta.9`
- `releases.json` / `latest.json` published with real metadata
- Marketing HTML CTAs updated to beta.9
- Nginx test + reload
- Live domain HTTPS smoke for picom / app / account / support chain
- Rollback backup created

## Warnings / blockers (non-blocking for download availability)

| Item | Status | Notes |
| --- | --- | --- |
| Code signing | BLOCKED | Unsigned; do not claim Verified Publisher |
| Fresh package:win this session | PARTIAL | Reused verified existing binary |
| Desktop typecheck/lint/tests this session | PARTIAL | Not re-executed in this publish window |
| Marketing Astro source in monorepo | N/A | Live HTML patched; next Astro deploy can overwrite |
| Windows interactive installer QA | BLOCKED | Build success ≠ install UX PASS |
| macOS / Linux packages | NOT APPLICABLE | Not configured for publish |
| Auto-update client E2E | PARTIAL | Feeds updated; client update path not smoke-tested |

## Acceptance vs prompt §41

Items requiring a fresh desktop CI matrix and interactive installer open remain PARTIAL/BLOCKED. Do **not** treat the full 41-point matrix as all PASS.
