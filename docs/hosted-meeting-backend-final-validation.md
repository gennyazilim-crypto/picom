# Hosted Meeting Backend Final Validation

## Purpose

Task 577 is Picom's protected final staging gate for the release-scoped meeting backend. It combines the committed migration contract, Supabase RLS and Realtime, meeting token and webhook Edge Functions, the two-client meeting matrix, private-data isolation, audit evidence, and fixture-access revocation. A missing environment is `BLOCKED`, never `PASS`.

## Coverage

The canonical matrix is `tests/hosted/meeting-final-backend-matrix.json`. It covers owner, admin, moderator, member, visitor, guest, and blocked identities across:

- committed migration parity with staging;
- room, participant, history, transcript, and caption isolation;
- meeting token authorization, waiting-room admission, and invite boundaries;
- webhook signature, replay, and idempotency;
- participant/session reconciliation and private Realtime delivery;
- durable meeting chat, reactions, raised-hand signaling, and notifications;
- caption endpoint behavior only when a provider is enabled;
- audit-log access and temporary fixture-access revocation;
- redacted artifact secret scanning.

## Safe contract check

Run:

`node scripts/hosted-final-meeting-backend-validation.mjs`

This validates the matrix and current redacted evidence structure without opening a network connection or reading protected values. The committed evidence is intentionally `BLOCKED` while the protected staging environment is unavailable.

## Protected execution

1. Use the GitHub `hosted-staging` environment or an equivalent approved isolated project.
2. Use synthetic accounts only and verify no fixture can access production.
3. Apply the committed migration set and export a redacted staging migration inventory/checksum comparison.
4. Populate `docs/evidence/task-577/` with redacted test records. Never include message bodies, transcript text, tokens, passwords, keys, provider identities, URLs containing credentials, raw media, or private user data.
5. Update a separate evidence JSON matching `docs/evidence/task-577-hosted-meeting-backend.json`.
6. If captions are disabled, record `NOT_APPLICABLE` only for `caption_endpoint_when_enabled`; private caption/transcript isolation remains mandatory.
7. Revoke or delete every temporary account/session/invite after testing and record the revocation timestamp.
8. Set `PICOM_FINAL_MEETING_CONFIRM=STAGING_ONLY` and run:

   `node scripts/hosted-final-meeting-backend-validation.mjs --run --evidence <redacted-evidence.json>`

The runner first validates all evidence and then executes the existing migration, secret, meeting contract, hosted RLS, hosted Realtime, hosted Edge, and two-client LiveKit validators. Any missing value, missing reference, denied network call, privacy failure, stale migration, or non-revoked fixture fails the gate.

## Current result

- Local final-matrix contract: PASS.
- Local deterministic meeting and secret contracts: PASS through the normal task validation suite.
- Hosted staging final matrix: BLOCKED.
- Caption endpoint: NOT APPLICABLE because no provider is configured; transcript privacy remains release-blocking.
- Migration parity, role accounts, private fixtures, deployed meeting token/webhook, two-client media, and fixture revocation evidence: unavailable.

RB-01 through RB-04 therefore remain open. No production deployment or private-data access is authorized by this document.
