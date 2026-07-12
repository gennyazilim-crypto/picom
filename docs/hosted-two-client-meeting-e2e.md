# Hosted two-client meeting end-to-end

## Safety boundary

Task 575 is a protected staging certification, not a mock test. The runner never targets production, never accepts service-role credentials, never writes credential values to evidence, and never stores raw microphone, camera, or screen media. Its default mode performs schema/contract validation only and reports the real hosted status from the checked-in redacted evidence.

Current status: **BLOCKED**. The July 11, 2026 preflight found no protected meeting staging variables, no synthetic host/waiting/blocked accounts, no LiveKit staging configuration, no Supabase CLI, and no second native client. The open Supabase browser dashboard does not satisfy those requirements and was not treated as evidence.

## Required protected environment

Use CI/staging secret storage or an ignored local environment file. Required names are enforced by the runner and existing token/webhook validators. Values must never be copied into docs, screenshots, logs, shell history, or commits.

Confirm all three guards are exactly `STAGING_ONLY`:

- `PICOM_HOSTED_MEETING_CONFIRM`
- `PICOM_MEETING_LIVEKIT_STAGING_CONFIRM`
- `PICOM_LIVEKIT_WEBHOOK_STAGING_CONFIRM`

The account matrix needs distinct allowed/host, waiting, blocked, and second participant identities. Use only publishable/anon Supabase credentials in clients. Service-role and LiveKit API secrets remain server-side; the webhook validator receives its protected signing fixture only in the guarded runner environment.

## Native execution

1. Apply the release-candidate migrations and deploy authenticated `meeting-token`, signed `livekit-webhook`, and configured caption function if captions are in scope.
2. Create a disposable staging room/session and synthetic users; never reuse production users or content.
3. Open two clean Picom Electron clients with separate sessions. Record platform/runtime/build commit, but no local absolute paths.
4. Execute all 19 flows in `tests/e2e/meeting-two-client-hosted-matrix.json`.
5. For audio and Noise Shield, use human observer checks; do not record audio.
6. For camera and screen share, capture only redacted UI screenshots. Do not store frames or source thumbnails beyond the app's transient picker.
7. Verify waiting/admission and unauthorized denial before granting membership.
8. Verify chat, reactions, hand state, layouts, mini navigation, reconnect, leave/end, webhook attendance, and notifications from both clients.
9. Mark captions `NOT_APPLICABLE` only when the staging provider is intentionally unconfigured; otherwise test explicit consent/start/stop.
10. Place redacted evidence under `docs/evidence/task-575/`, update the JSON to `PASS`, and run the protected validator.

```powershell
node scripts/hosted-two-client-meeting-e2e.mjs --run --evidence docs/evidence/task-575-hosted-two-client-meeting-e2e.json
```

The command first validates complete two-client evidence, then runs the existing allowed/waiting/blocked token matrix and valid/duplicate/tampered/expired webhook matrix. Any missing flow, missing evidence file, non-staging confirmation, or external check failure exits nonzero.

## Evidence rules

- References are repository-relative and must remain under `docs/evidence/task-575/`.
- Evidence objects reject keys resembling passwords, credentials, tokens, authorization headers, service-role values, private keys, or connection strings.
- Screenshots must redact names/emails/private message content and show only the minimum state needed.
- Logs contain safe event IDs/status codes and timestamps, never JWTs, provider payloads, raw bodies, or local paths.
- `PASS` is allowed only with both real clients passing every required flow plus protected token and webhook checks.
- Missing provider/native access is `BLOCKED`, not a local mock pass.
