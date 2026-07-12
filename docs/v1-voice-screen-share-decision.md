# Picom V1 Voice and Screen Share Decision

Decision: **HIDDEN_FROM_V1**

Decision date: 2026-07-12. This is a scope closure, not a provider certification.

## Evidence matrix

| Include requirement | Evidence | Result |
|---|---|---|
| Hosted secure token issuance | Local authorization/secret-boundary contracts exist; `livekit-token` is not deployed by the V1 manifest | BLOCKED_HOSTED |
| Authorized and unauthorized room tests | No protected staging credentials or immutable hosted run | BLOCKED_HOSTED |
| Two-client audio, mute, participant state | Local structural state tests only; no two isolated media clients | BLOCKED_HOSTED |
| Reconnect and cleanup | Local reconnect/cleanup contracts only | BLOCKED_HOSTED |
| Packaged Windows microphone/device behavior | No exact installed V1 candidate device run | BLOCKED_NATIVE |
| Packaged Windows source picker/cancel | IPC contract exists; no installed-candidate interactive run | BLOCKED_NATIVE |
| Remote screen render | No real remote LiveKit participant evidence | BLOCKED_HOSTED / BLOCKED_NATIVE |
| Stop/unpublish/cleanup | Structural contracts only | BLOCKED_HOSTED / BLOCKED_NATIVE |
| Provider secret isolation | Renderer service contains no LiveKit API key/secret; token secrets remain Edge-only | PASS_LOCAL |

One or more critical include requirements are blocked, so neither capability can be advertised or partially shipped in V1.0.0.

## V1 behavior

- Voice and Screen Share are classified `HIDDEN_FROM_V1`, not `CONDITIONAL`.
- Voice channels are filtered from sidebars and active/deep-linked channel resolution.
- Connected Voice, active room discovery and screen-share controls are absent from Feed.
- Voice & Video settings and Community Admin's voice toggle are gated out.
- First Launch contains no voice, microphone or screen-share promise.
- Help and beta release copy do not claim Voice support.
- Authenticated voice/meeting routes fail the V1 route gate.
- `client-config` keeps both feature flags false.
- LiveKit token/moderation/webhook functions are excluded from the V1 deployment manifest.

The underlying services, IPC, functions, migrations and stored data remain intact for future certification. No existing data was deleted.

## Security boundary

LiveKit API key/secret values remain server-side Edge Function inputs. Renderer services receive only user-scoped token responses and contain no provider credential names. Electron remains context-isolated with validated preload methods; retaining dormant screen-capture IPC does not expose a V1 control.

## Reopening criteria

A future release must create a new scope decision and attach immutable hosted token/two-client evidence plus the exact signed Windows candidate's microphone, picker, remote-render, cancel, stop, reconnect and cleanup results. Local mock or structural tests are insufficient.
