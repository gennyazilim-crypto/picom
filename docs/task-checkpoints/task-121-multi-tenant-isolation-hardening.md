# Task 121 Checkpoint: Multi-tenant Isolation Hardening

## Result

Reviewed tenant-like community boundaries across database, feed/profile, attachments, realtime, Storage, bots/webhooks, search, and restricted administration. Fixed two concrete access gaps and one client-side derived-content gap.

## Fixes

- Storage object reads for attached files now require linked message/channel visibility, not community membership alone.
- Typing and Presence use private Supabase Realtime channels.
- Added `realtime.messages` RLS for exact typing/presence topics and membership/channel visibility.
- Mention Feed stories and upcoming events are filtered before rendering by current access.
- Added structural pgTAP assertions and malformed/cross-extension topic denial cases.

## Known blocked verification

- Repository checks cannot prove live Supabase RLS, Storage, or Realtime behavior without a disposable project/CLI.
- Two-user socket and known-private-object download tests remain mandatory before connected beta/stable.
- Typing/Presence payload identity is client-supplied and must not be trusted for security/moderation until bound to authenticated identity.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`

