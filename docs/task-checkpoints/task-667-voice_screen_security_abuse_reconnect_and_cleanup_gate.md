# Task 667 Checkpoint: Voice Screen Security Abuse Reconnect and Cleanup Gate

## Gate design

Task 667 combines three independent fail-closed evidence layers:

1. Nineteen local security/reliability contracts for authorization, RLS, IPC
   validation, reconnect, device/permission recovery, participant reconciliation,
   Noise Shield lifecycle, abuse controls, runtime bounds, leak checks, Electron
   security, and secret exposure.
2. A fresh protected Supabase/LiveKit token matrix for approved active members,
   roleless membership, visitor/non-member/banned/suspended denial,
   cross-community denial, canonical room/identity, 600-second TTL, token refresh,
   CORS/method/body/JWT validation, and 10-per-60-second rate limiting.
3. A fresh real four-client LiveKit media matrix plus the approved packaged
   Windows Task 666 artifact for reconnect, remote render, source-ended/restart,
   normal app restart, and resource cleanup.

## Security boundaries

- Ordinary Voice/Screen access depends on authentication and active membership,
  not Owner/Admin/Moderator/custom-role grants.
- Moderation authorization remains separate and hierarchy controlled.
- Renderer/UI code receives no provider secret or server administration key.
- Screen IPC remains fixed-input, sender-checked, session-bound, expiring, and
  deterministic-fuzz tested.
- Evidence contains counts and booleans only. Tokens, fixture identities, raw
  audio, and screen frames are neither persisted nor uploaded.
- Required checks do not use `continue-on-error`.

## Honest limitation

The protected gate proves the hosted moderation authorization hierarchy and the
provider mute/remove implementation contract. It does not claim a fresh provider
mute/remove/end-room execution. Packaged Windows physical microphone,
multi-monitor, and additional DPI limitations remain recorded by Task 666.

## Commands

- `npm run voice:screen:security:gate`
- `npm run voice:screen:hosted:contract`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`
- Protected workflow: `Picom Voice Screen Security Reliability Gate`

## Status

The source and protected workflow gate are prepared. Completion is recorded only
after the workflow produces a redacted Task 667 artifact with `status=passed`.
