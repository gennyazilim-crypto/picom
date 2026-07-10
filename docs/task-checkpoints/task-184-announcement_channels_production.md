# Task 184: Announcement channels production

## Completed

- Reasserted owner/admin/sendAnnouncements-only backend posting.
- Added member-owned Follow/Following preferences with RLS.
- Added compact header control and preserved read-only Composer explanations.
- Preserved distinct Picom token-based styling.
- Documented and tested the no-cross-posting boundary.

## Verification

- `npm run announcement:channel:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
