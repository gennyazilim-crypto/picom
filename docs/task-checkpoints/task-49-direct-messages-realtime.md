# Task 49 - Direct Messages Realtime and Notifications

Date: 2026-07-10
Status: Complete

## Result
- Added member-verified Supabase conversation subscriptions and a deterministic mock event bus.
- Handles DM insert/update/delete and reaction add/remove without touching community realtime.
- Reconciles optimistic messages by server ID or `client_message_id` and updates unread badges.
- Routes privacy-safe DM desktop notifications through notificationService, including active/focused suppression and quiet-hours settings.
- Added publication migration and a two-window smoke plan.

## Validation
- `npm run typecheck`
- `npm run supabase:smoke`
- `npm run mock:smoke`
- `npm run build`

## Remaining live check
Run `docs/direct-messages-realtime-smoke.md` against a configured non-production Supabase project. Static checks do not prove deployed Realtime RLS delivery.
