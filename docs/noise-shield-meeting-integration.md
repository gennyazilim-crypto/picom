# Noise Shield Meeting Integration

## Scope

Picom has one canonical Noise Shield state for meeting microphone capture. PreJoin tests, LiveKit microphone publication, input-device replacement, unmute, and reconnect all use the same capture-plan service. Screen-share audio, Radio, Podcast, music, and studio media do not use this path.

## Truthful capability model

- `Off` is always available.
- `Standard` is available only when Chromium reports native `noiseSuppression` support.
- `Enhanced` and `Voice Focus` remain unavailable because this build has no approved processing provider for them.
- Picom does not claim ML, neural, or provider-backed suppression.
- If native constraints fail, the meeting restores an unprocessed microphone and reports the fallback instead of blocking the call.

The UI distinguishes requested mode, applied mode, provider, status, and fallback reason. It never presents an unavailable mode as active.

## Lifecycle

1. PreJoin activates meeting-scoped Noise Shield state.
2. A microphone capture plan is generated from real browser capabilities.
3. The same helper publishes or replaces the LiveKit microphone track.
4. Device switching, unmute, and reconnect reapply that plan.
5. Leaving the meeting unsubscribes the session and resets the canonical state.

No raw microphone media is recorded, persisted, uploaded, or logged.

## Validation limits

- Static lifecycle and integration contracts run locally and in ordinary QA.
- Renderer build and performance budgets verify that the integration does not create a second eager media stack.
- Real native microphone quality and failure behavior remain **BLOCKED** until Windows, Linux, and macOS hardware sessions are executed.
- Hosted LiveKit reconnect evidence remains **BLOCKED** without configured staging credentials and a two-client environment.
