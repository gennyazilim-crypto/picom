# Task 345 - Memory leak extended audit

Status: source audit/remediation complete; packaged long-run heap evidence remains pending.

## Delivered

- Audited Object URLs, message/typing/presence/DM realtime subscriptions, LiveKit listeners, screen share tracks, timers, media-device listeners, network/sleep-wake listeners and API abort listeners.
- Replaced accumulating message-highlight timeouts with one tracked timer cleared on replacement and unmount.
- Hardened unexpected LiveKit disconnect to stop local tracks, remove room listeners and clear the global room reference.
- Added a structural regression command and a findings/manual long-run document.
- Added no UI redesign or mobile UI.

## Validation

- `npm run memory:leak:extended:audit`
- `npm run realtime:ordering:smoke`
- `npm run livekit:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Remaining work

- Execute packaged multi-hour/heap/media-device runs on Windows, Linux and macOS.
- Record Supabase channel counts and LiveKit capture release during real staging reconnect cycles.
- Structural source checks do not prove a flat heap; measured evidence is required for stable release.

