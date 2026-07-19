# V1 Voice and Screen Scope Amendment

Voice Rooms and Screen Share are mandatory `IN_V1` capabilities for Picom 1.0.0.

The former `HIDDEN_FROM_V1` product conclusion is superseded. Task 621 and the earlier Task 642/643 checkpoints remain truthful historical infrastructure evidence: they show that hosted and native certification was blocked at that time, not that the features were outside the product.

Tasks 657-673 implement and certify the self-hosted provider, authenticated token service, ordinary active-member media access, Screen Share, TURN/public networking, security, reconnect, cleanup and native Windows behavior. Task 674 confirms release readiness; it does not add the features to scope because they are already included. Tasks 675-676 build and decide the final release candidate.

## Canonical state

- Product scope: Voice Rooms `IN_V1`; Screen Share `IN_V1`.
- Implementation: in progress until all local and hosted flows pass.
- Infrastructure: local-ready where structural checks pass; hosted/production blocked until provider deployment and evidence exist.
- Release readiness: blocked until RB-04 and RB-05 plus the remaining production gates close.

Every authenticated active community member may join a visible Voice channel, publish microphone audio, subscribe to remote audio, start Screen Share and view remote Screen Share. Unauthenticated, non-member, pending, banned, suspended, kicked/removed users and invalid rooms are denied. Private-channel access remains enforced. Muting/removing another participant, banning and ending a room remain role controlled.

The release remains No-Go only while real implementation or evidence blockers exist. Missing task numbers never change product scope.
