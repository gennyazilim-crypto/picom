# Task 561 - Noise Shield Integration with Meeting Workspace

## Status

Implemented with truthful provider gating. Native/hosted evidence remains blocked as listed below.

## Delivered

- Added canonical requested/applied Noise Shield types, store, and meeting-only service.
- Routed PreJoin microphone testing and LiveKit microphone publication through one capability-gated capture plan.
- Reapplied processing after microphone replacement, device switching, unmute, and reconnect.
- Added non-disruptive unprocessed-microphone fallback.
- Exposed available modes and requested/applied/fallback state in PreJoin, the meeting dock, mini meeting card, and meeting information panel.
- Kept screen-share audio, Radio, Podcast, music, and studio paths outside Noise Shield.

## Provider truth

- `Standard`: Chromium native noise suppression, only when reported by the runtime.
- `Enhanced`: unavailable; no approved provider is configured.
- `Voice Focus`: unavailable; no approved provider is configured.
- No ML or third-party suppression claim is made.

## Validation

- PASS: `node scripts/noise-shield-meeting-integration-smoke.mjs`
- PASS: `node scripts/meeting-prejoin-full-mvp-smoke.mjs`
- PASS after aligning its stale static confirmation-text assertion with the existing dynamic host-control copy: `node scripts/meeting-control-dock-full-mvp-smoke.mjs`
- PASS: `node scripts/connected-meeting-integration-smoke.mjs`
- PASS: `npm run typecheck`
- PASS: `npm run mock:smoke`
- PASS: `npm run build`
- PASS: `npm run performance:budget:ci`
  - initial JS: `1183.9 KiB` (target `1200 KiB`, hard cap `1650 KiB`)
  - initial CSS: `235.1 KiB` (warning target `180 KiB`, hard cap `240 KiB`)
  - total assets: `3324.0 KiB` (warning target `2800 KiB`, hard cap `3500 KiB`)
- PASS: `npm run qa:smoke`

## Blocked evidence

- Native microphone quality/lifecycle evidence on Windows, Linux, and macOS: **BLOCKED**, requires hardware sessions.
- Hosted LiveKit reconnect/two-client evidence: **BLOCKED**, requires configured staging credentials and infrastructure.
