# Task 666 checkpoint: Self-hosted screen share publish and remote render

## Result

`PASS_LOCAL_BLOCKED_EXTERNAL`

The existing Picom screen-share stack was retained and locked with a self-hosted regression contract. An active member can explicitly select a screen/window through the validated Electron bridge, publish it to the self-hosted LiveKit room, and a second client can render the remote track. Cloud LiveKit is not required.

## Completed

- Confirmed source listing, selection, refresh, cancellation, and selection expiry are handled by the bounded preload IPC bridge.
- Confirmed ordinary active-member sharing has no Owner/Admin/Moderator role gate.
- Confirmed local publish uses `Track.Source.ScreenShare` and remote tracks retain participant identity.
- Confirmed simultaneous shares are represented by participant/track and exposed through a visible switcher.
- Confirmed stop, source-ended, participant-left, disconnect, and room-leave cleanup paths.
- Confirmed system-audio capture remains disabled pending platform certification.
- Added deterministic Task 666 contract smoke, documentation, and redacted evidence.

## Targeted verification

- `npm run screen:self-hosted:smoke`: required.
- `npm run livekit:local:e2e`: real local two-client self-hosted publish/render path.
- `npm run typecheck`: required.

## Blocked external evidence

- Packaged Windows source picker and permission recovery: Task 673.
- Native macOS Screen Recording permission behavior: Tasks 671/673.
- Internet/TURN screen transport: Task 672.

These evidence gaps block public release certification only. They do not disable or hide the V1 Voice Room or Screen Share UI.

## Evidence

- `docs/evidence/task-666-self-hosted-screen-share.json`
- `docs/self-hosted-livekit-screen-sharing.md`

No provider secret, access token, TURN credential, raw screen content, thumbnail, or private host value is included.
