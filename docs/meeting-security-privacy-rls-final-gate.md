# Meeting Security, Privacy, and RLS Final Gate

## Decision

- Deterministic/local gate: **PASS**
- Hosted unauthorized-access gate: **BLOCKED**
- Native media-indicator/permission evidence: **BLOCKED**
- Stable release: **NO-GO**

No local/static test found an unauthorized data path, raw-media persistence, or renderer secret exposure. This is not deployed enforcement evidence. The protected Task 577 matrix and native Tasks 578-580 remain blocked, so Picom may not claim final meeting security certification.

## Access matrix

`tests/security/meeting-security-final-gate.json` defines a private invite-required room with an admitted guest and classifies owner, admin, moderator, member, visitor, guest, blocked, and non-participant access for:

- room metadata and participant list;
- invite management and attendance history;
- meeting chat and captions/transcript;
- moderation and screen-share publication;
- LiveKit meeting token issuance.

Blocked and non-participant identities are denied every resource. Visitor access is denied because this fixture is private. Guest access is limited to the admitted session and cannot manage invites, moderate, or publish screen media. Frontend state is not an authority; Supabase RLS/RPC and Edge authorization must enforce every result.

## Executed local controls

`node scripts/meeting-security-privacy-rls-final-gate.mjs` executes 15 existing fail-closed controls:

- 187-migration integrity and meeting RLS policy contracts;
- token identity/TTL/least-privilege grants, CORS, input limits, and waiting/blocked denial;
- webhook signature, body hash, expiry, tamper denial, and replay idempotency;
- privacy consent, immutable audit, retention, captions, and no-raw-media boundaries;
- database-authoritative reaction/hand/chat limits and safe log markers;
- meeting diagnostics/log redaction;
- Electron context isolation, sandbox/preload limits, invalid IPC fuzzing, and source-picker sender/payload validation;
- runtime secret and diagnostics/logging exposure scans.

These checks are deterministic source/SQL/mock contracts. They do not open Supabase, LiveKit, native device, or screen sources.

## Consent and media indicators

- Microphone, camera, screen share, Noise Shield, and captions require explicit user actions and display separate applied/active/fallback state.
- Screen capture uses validated main/preload IPC and never exposes raw Electron objects to React.
- Captions require consent and provider gating; transcript access/retention is RLS-backed by contract.
- Diagnostics may contain safe state, counts, timings, and reason codes only. Raw audio/video/screen frames, message/chat body, transcript text, invite material, provider identity, and tokens are prohibited.
- Leave/end/reconnect cleanup contracts remove tracks, subscriptions, listeners, transient reactions, and stale participant state.

## Release rule

Any confirmed unauthorized room, participant, history, chat, caption, moderation, token, or media access is a critical release blocker. Any secret/log leak, invisible active capture, missing consent, raw-media persistence, or unbounded retention is also release-blocking. Do not downgrade these findings to known issues.

The exact remediation list is in `docs/meeting-security-remediation.md`. RB-01 through RB-05 and the native package blockers remain open.
