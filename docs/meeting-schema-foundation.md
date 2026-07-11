# Supabase Meeting Schema Foundation

## Scope

Migration `20260711153100_meeting_schema_foundation.sql` adds metadata-only persistence for Picom meetings:

- `meeting_rooms`: durable room source, mode, lifecycle, host, policy, capabilities and linked chat.
- `meeting_sessions`: one LiveKit provider-room projection per idempotent session start.
- `meeting_session_participants`: ephemeral provider identity mapped to an optional Picom profile.
- `meeting_waiting_entries`: admission lifecycle and idempotent requests.
- `meeting_invites`: hashed invite tokens only; raw invite secrets are never persisted.
- `meeting_events`: idempotent normalized backend/LiveKit/webhook/client events.
- `meeting_attendance`: privacy-bounded session attendance and reconnect counts.

`audit_log` receives nullable room/session references so durable moderation/audit records can point to meeting metadata without cascading audit deletion.

## Integrity and deletion behavior

- Rooms belong to one community. Community deletion cascades meeting workspace data consistently with existing community-owned content.
- Voice channel, scheduled event and linked chat references are validated against the same community.
- Source channels/events use `set null` so historical room/session records survive controlled channel/event removal where the source contract allows it.
- Profile references that express accountability use `restrict`; historical participant/attendance identity links use `set null` where anonymization is required.
- Session-owned participant/event/attendance rows cascade only when the containing session is intentionally removed.
- Meeting audit references use `set null`; normal meeting deletion cannot delete audit history.

## Security boundary

All seven tables have RLS enabled and are revoked from `anon` and `authenticated` in Task 531. Task 532 must add least-privilege policies and grants. Until then only trusted migration/service execution can access them.

No column stores raw audio, camera video, screen media, recording output, provider tokens or credentials. JSON metadata/payload constraints reject top-level raw-media and token keys. Webhook payloads must be verified and normalized before insertion.

## Index and idempotency strategy

- Community/status/schedule/channel/event indexes support room discovery.
- Room/status and active-session indexes support reconnect and cleanup.
- Session/state/user indexes support participant reconciliation.
- Waiting/invite status and expiration indexes support admission lifecycle.
- Event source/idempotency and provider-event uniqueness prevent retry duplicates.
- Attendance session/user indexes support history without scanning event payloads.

## Seed and generated types

The local-only seed adds one deterministic meeting room/session, two participants, one hashed invite and one normalized event. It uses no hosted credentials and must never be deployed as production data. `database.types.ts` contains all new rows/inserts/updates, while Task 530 mock fixtures remain the renderer-development parity source.

## Forward-fix and Rollback

### Forward-fix

Production migrations are append-only. If a constraint, index or column needs correction, add a later migration that safely backfills and then tightens behavior. Do not edit this migration after it has been applied.

### Rollback

Dropping meeting tables destroys attendance and event metadata and is not a generally safe production rollback. Before any destructive rollback, stop meeting creation, export metadata, verify backup restore, and confirm no later migration depends on these tables. Prefer disabling the meeting feature and applying a forward fix. Audit rows must remain retained even if their nullable meeting references are cleared.

Supabase CLI/local database execution is still required to prove actual PostgreSQL application and rollback behavior; structural smoke alone is not hosted evidence.
