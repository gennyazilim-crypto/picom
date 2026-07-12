# Task 560 checkpoint - Connected Voice and mini meeting integration

- Added a lazy global mini meeting surface for voice, camera, screen sharing, and stage sessions.
- Added capability-gated microphone, deafen, camera, Noise Shield, share-return, and Leave controls.
- Added workspace minimize/restore without disconnecting or creating another LiveKit room.
- Added same-session restore and different-session guard at the deep-link boundary.
- Added reconnect, failed, disconnected, ended, participant-count, community, and room state messaging.
- Added participant navigation minimization, app-shutdown cleanup, and Feed voice-card deduplication.

Hosted multi-client LiveKit navigation evidence remains BLOCKED until protected staging credentials and a second authenticated client are available. Local contract, typecheck, mock, build, performance, and QA checks are required before commit.
