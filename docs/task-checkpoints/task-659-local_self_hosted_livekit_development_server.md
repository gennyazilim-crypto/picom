# Task 659 Checkpoint: Local Self-Hosted LiveKit Development Server

## Status

Implemented and locally validated on Windows with Docker Desktop. Picom Voice Rooms and Screen Share remain active V1 product surfaces; this task provides the real local self-hosted media provider rather than hiding either feature.

## Delivered

- LiveKit Server `1.13.1` pinned by official archive checksum for native Windows/Linux and immutable digest for optional Docker.
- Native Windows provider avoids Docker Desktop loopback ICE/NAT failure while retaining a Docker path for later topology work.
- Isolated `picom-livekit-local` lifecycle on ports `17880-17882`.
- Fresh runtime-only development credentials with production-promotion guards.
- Loopback default and explicit private-LAN mode.
- Public renderer endpoint example with no provider credentials.
- Health, stop, cleanup, and port-release checks.
- Two sandboxed Electron clients using the existing media fixture.
- Real provider join, bidirectional synthetic audio, participant state, mute/unmute, simultaneous synthetic screen publication/render, reconnect, leave, and track cleanup.

## Validation

- `npm run livekit:local:contract`: PASS
- `npm run livekit:local:start`: PASS with verified native Windows provider
- `npm run livekit:local:health`: PASS
- `npm run livekit:local:e2e`: PASS
- `npm run livekit:local:cleanup`: PASS; target ports released
- `npm run typecheck`: PASS
- `npm run mock:smoke`: PASS

Redacted evidence: `docs/evidence/task-659-local-self-hosted-livekit.json`.

## Boundaries

- No LiveKit Cloud subscription is used.
- No real microphone audio or desktop image is recorded by the automated test.
- No key, token, TURN credential, private address, or raw provider log is committed.
- Public internet/TURN and packaged native picker evidence are not claimed here.
- Staging/production remain blocked until their dedicated infrastructure and certification tasks pass.
