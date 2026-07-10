# Production LiveKit Validation

Status date: 2026-07-10  
Overall result: **Local contracts passed; production certification blocked**

## Passed locally

- LiveKit dependency and renderer service wiring.
- Deterministic room naming.
- Voice room UI and participant-state contracts.
- Device selection contract.
- Reconnect/recovery contract.
- Connected voice mini-card and active-room discovery contracts.
- Supabase `livekit-token` Edge Function contract exists.
- Electron screen-share bridge is represented by the local smoke suite.
- Standardized voice errors and redacted diagnostics are present.

## Security boundary

- LiveKit API key and secret belong only in the server/Edge Function secret store.
- Electron receives a short-lived participant token, never the API secret.
- Room/token authorization must be checked server-side against authenticated community/channel access.
- Deterministic room naming is not authorization.

## Blocked production tests

No approved Supabase/LiveKit staging configuration or two-client device matrix was available. The Edge Function runner completed preflight only and made no network connection.

The following remain Blocked:

- Two authenticated clients joining the same permitted room.
- Visitor/non-member/private-channel join denial.
- Mute/unmute, deafen/undeafen, speaking indicator, and participants list with real media.
- Reconnect after a network interruption.
- Leave cleanup and remote participant departure.
- Token expiry/refresh behavior and failed token fetch UX.
- Microphone permission denial/retry on Windows/Linux/macOS.

## Required execution

1. Configure an approved staging project and LiveKit deployment with synthetic accounts.
2. Deploy `livekit-token` with server-only secrets.
3. Run `npm run edge:staging:test` with explicit staging confirmation.
4. Complete the two-client manual matrix and archive redacted logs.

RB-04 remains open. Picom must not advertise production-certified voice until this evidence passes.

## Task 397 closure attempt

All local voice/device/recovery/mini-card/discovery contracts passed on 2026-07-10. Hosted token issuance, two-client media, authorization, reconnect, and cleanup were not run because Task 396 staging access remained unavailable. See `docs/hosted-livekit-two-client-validation.md`.
