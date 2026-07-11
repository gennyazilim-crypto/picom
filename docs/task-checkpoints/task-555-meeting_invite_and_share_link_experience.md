# Task 555 - Meeting Invite and Share-Link Experience

## Completed

- Added secure create/copy, retry-copy, revoke, regenerate, list, and schedule UI.
- Added participant versus signed-in guest policy, expiry, and use limits.
- Added truthful room/community/host/schedule/capability/waiting-policy preview.
- Added strict meeting invite deep-link parsing and a desktop-shell gateway to PreJoin.
- Added just-in-time invite redemption before meeting authorization.
- Added atomic server-side invite regeneration and expanded privacy-safe preview data.
- Added explicit expired, revoked, exhausted, blocked, locked, ended, and not-started states.

## Validation

- `node scripts/meeting-invite-experience-smoke.mjs`
- `node scripts/meeting-schedules-invites-join-policy-smoke.mjs`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Hosted Supabase migration/RLS execution and native protocol activation remain BLOCKED until protected staging and native package runners are available. No hosted/native pass is claimed here.
