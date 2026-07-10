# Hosted LiveKit Two-Client Validation

Status date: 2026-07-10  
Result: **Not ready - hosted two-client evidence unavailable**

## Local evidence

The LiveKit dependency, deterministic room naming, token Edge Function contract, device selection, reconnect/recovery, Connected Voice card, active-room discovery, screen-share bridge, standardized errors, and redacted diagnostics all passed deterministic smoke tests.

The Edge staging runner also proves a fail-closed contract for CORS/JWT checks and short-lived channel-bound tokens, but only its non-network preflight ran because the staging Supabase/LiveKit environment was not configured.

## Required hosted matrix

| Scenario | Result |
| --- | --- |
| Authenticated short-lived token | Blocked |
| Unauthenticated/unauthorized denial | Blocked |
| Two independent clients join and exchange audio | Blocked |
| Participant count and duplicate prevention | Blocked |
| Mute/deafen/speaking state across clients | Blocked |
| Network interruption and recovery | Blocked |
| Track/listener cleanup on leave | Blocked |
| Private voice-channel authorization | Blocked |
| Connected Voice card against real room state | Blocked |

No microphone audio, token, identity, URL, or private room information was recorded.

## Required completion

Deploy `livekit-token` to the approved staging project with server-only LiveKit secrets. Run `npm run edge:staging:test`, then test two isolated Electron sessions/accounts on real devices. Capture redacted participant-state and error-code evidence only.

## Recommendation

**Not ready.** RB-04 remains open. Picom must not advertise production-certified voice based on deterministic smoke tests alone.
