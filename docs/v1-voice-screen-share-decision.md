# Picom V1 Voice and Screen Share Decision

Current decision: **IN_V1**

The former Task 621 `HIDDEN_FROM_V1` conclusion is retained as historical infrastructure evidence but is superseded by the product-scope amendment dated 2026-07-12.

## Scope versus readiness

- Voice Rooms are mandatory Picom V1 product scope.
- Screen Share is mandatory Picom V1 product scope.
- Missing hosted, TURN, native-device, signing, or clean-machine evidence blocks public release; it does not remove either feature from V1.
- Task 674 confirms release readiness rather than reclassifying scope.

## Current evidence

| Requirement | Current result |
|---|---|
| Local renderer, preload, picker, token and secret-boundary contracts | PASS_LOCAL |
| Hosted secure token issuance and unauthorized denial | BLOCKED_HOSTED |
| Two-client audio, reconnect and cleanup | BLOCKED_HOSTED |
| TURN/public-network traversal | BLOCKED_HOSTED |
| Packaged Windows microphone and source picker | BLOCKED_NATIVE |
| Remote screen render, stop and cleanup | BLOCKED_HOSTED / BLOCKED_NATIVE |

The release therefore remains No-Go until the blocked evidence passes. UI entry points remain visible and report precise operational errors when infrastructure is unavailable.

## Security boundary

LiveKit API key and secret values remain Edge Function secrets. The renderer receives only short-lived, authenticated participant tokens. Active community membership permits ordinary join, microphone publishing and screen sharing; private-channel access and moderation remain server enforced.
