# Task 188: Direct messages UI production

## Completed

- Kept the dedicated ServerRail DM entry and Mention Feed Home behavior.
- Connected the composer lifecycle to backend success/failure.
- Added sending lock, inline failure state, and draft preservation.
- Preserved conversation list, chat view, unread badges, and desktop-only layout.

## Verification

- `npm run dm:production:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
