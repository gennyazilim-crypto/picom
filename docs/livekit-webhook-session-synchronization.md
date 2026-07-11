# LiveKit webhook verification and session synchronization

Task 536 makes verified provider webhooks authoritative for final room, participant, track, and attendance lifecycle state. Renderer join/leave events remain responsive hints only.

## Verification boundary

LiveKit sends `application/webhook+json` with an Authorization JWT bound to the exact raw body. Picom follows the official receiver contract: HS256 signature and issuer/time claims are checked, then the raw body SHA-256 digest is compared to the JWT `sha256` claim using standard Base64. See [LiveKit webhooks documentation](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/) and the [official Node WebhookReceiver source](https://github.com/livekit/node-sdks/blob/main/packages/livekit-server-sdk/src/WebhookReceiver.ts).

The installed project has `livekit-client@2.20.0` but no server SDK dependency. The Deno Edge helper implements the same small Web Crypto verification contract without adding a renderer/native dependency. API key, API secret, service-role key, Authorization header, and raw body never enter logs or persisted rows.

## Retry and idempotency

- `livekit_webhook_receipts` stores event ID, event type, canonical room name, SHA-256 hex digest, attempts, state, and a redacted error code only.
- A repeated event ID with the same digest returns a successful duplicate response without applying state twice.
- The same event ID with a different digest is rejected as replay mismatch.
- Processing failures persist only `PROCESSING_{SQLSTATE}` and return `503 Retry-After`, allowing LiveKit's provider retry behavior.
- Raw payload dead letters are intentionally prohibited. Operators investigate using event ID, type, receipt state, meeting event sequence, and provider dashboard metadata.

## Authoritative reconciliation

- `room_started` opens the session and room.
- `room_finished` closes the session, participants, tracks, open attendance intervals, and room.
- `participant_joined` marks the participant connected and starts/reopens attendance.
- `participant_left` and `participant_connection_aborted` close attendance with an authoritative final state.
- `track_published` and `track_unpublished` update metadata-only track rows. No media bytes are stored.
- Every processed provider event increments the session sequence and appends a redacted `meeting_events` record with provider idempotency.

## Operations

1. Inspect failed receipts by event ID and redacted `error_code` using an operator-only database session.
2. Confirm the canonical room/session still exists and the provider webhook signing key matches `LIVEKIT_API_KEY`.
3. Correct the external/configuration issue; allow LiveKit retry or resend a provider test event with the same ID/body.
4. Never copy raw webhook bodies, Authorization JWTs, or media metadata into tickets or logs.

`scripts/livekit-webhook-staging-validation.mjs --run` validates a real allowed event, duplicate delivery, tampered body, and expired JWT only with explicit `STAGING_ONLY` confirmation.
