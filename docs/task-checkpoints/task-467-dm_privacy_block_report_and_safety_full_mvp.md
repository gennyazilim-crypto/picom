# Task 467 Checkpoint: DM Privacy, Block, Report, and Safety Full MVP

Date: 2026-07-11

## Completed scope

- Added mock/Supabase-safe direct-message privacy preferences.
- Added duration-based conversation mute and accessible recovery through unmute.
- Added explicit block confirmation and immediate block-list synchronization.
- Added selected-message and participant report entry points using the existing report modal.
- Added participant-authorized, app-admin-reviewed DM reports without conversation transcript attachment.
- Added DM write/report rate limits and blocked-relationship enforcement for DMs, media, reactions, and friend requests.
- Added Privacy & Safety integration and blocked-user recovery.

## Security boundary

Frontend state is UX only. Supabase RPCs, RLS helper functions, grants, and policies remain authoritative. Reports never include an entire DM thread or unrelated private content.

## Validation contract

- `npm run dm:privacy:safety:smoke`
- `npm run blocking:privacy:smoke`
- `npm run content:reporting:ux:test`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Live pgTAP/RLS execution remains blocked until protected Supabase staging credentials and CLI access are available; structural SQL coverage does not claim hosted certification.
