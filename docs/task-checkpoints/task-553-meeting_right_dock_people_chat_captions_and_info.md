# Task 553 Checkpoint: Meeting Right Dock People Chat Captions and Info

## Delivered

- Added mutually exclusive People, Chat, and Info panels with a truthful hidden Captions provider gate.
- Added participant search, grouped counts, focus, stage role actions, and waiting-room admit/deny behavior.
- Added durable linked meeting chat loading, send, read state, realtime refresh, safe rendering, and mock fallback context.
- Added complete room information and safe meeting-link copy behavior.
- Persisted selected panel per session and added medium-desktop overlay collapse behavior.

## Validation

- `node scripts/meeting-right-dock-full-mvp-smoke.mjs`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Captions remain intentionally unavailable until Task 567 provides configured consent and provider evidence.
