# Task 180: Polls production

## Completed

- Added atomic poll and option creation.
- Added serialized duplicate-safe single/multiple choice voting.
- Added author/moderator poll closing.
- Enforced channel visibility and send permission in backend RPCs.
- Added realtime vote/close refresh with subscription cleanup.
- Added production smoke coverage and manual two-window checklist.

## Safety

- Direct authenticated poll table writes are revoked.
- Aggregate state does not expose voter lists.
- Backend permissions remain authoritative.

## Verification

- `npm run polls:foundation:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
