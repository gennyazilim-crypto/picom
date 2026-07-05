# Database transaction consistency pass

Picom's MVP runtime uses Supabase Auth, Postgres, RLS, Storage, Realtime, and Edge Functions. Browser/renderer Supabase clients should not attempt multi-step critical writes by chaining unrelated table mutations when atomicity matters. Those operations should move behind SQL functions or Edge Functions that run a single database transaction.

## Current status

This pass is intentionally documentation-first. It does not rewrite working MVP flows or introduce broad RPC replacements.

## Transaction rules

- Keep single-row client mutations simple when RLS is sufficient.
- Move multi-table writes to SQL RPC or Edge Functions.
- Emit realtime events only after the transaction succeeds.
- Keep audit/security records inside the same transaction as the moderated/admin action.
- Never rely on frontend-only state for ownership, permission, or membership consistency.

## Operation review

| Operation | Current path | Consistency status | Recommended transactional boundary |
| --- | --- | --- | --- |
| Register user + profile | Supabase Auth trigger | Transactional enough for MVP | Keep profile creation in trigger; monitor signup backfill failures. |
| Create community + owner member + default roles + channels | `communityService.createCommunity()` currently creates community row only | Partial MVP behavior | Future `create_community_with_defaults` SQL RPC or Edge Function. |
| Create channel + category/order update | `channelService.createChannel()` single insert | Acceptable for MVP create-only path | Use SQL RPC when reorder/category updates are bundled. |
| Send message + attachments | Message insert and attachment metadata are currently separate flows | Partial; attachments can remain pending | Future `send_message_with_attachments` RPC after upload metadata is stable. |
| Delete community | Placeholder/safety docs | Not enabled as production destructive flow | Owner-only Edge Function with audit log and soft-delete. |
| Transfer ownership | Local placeholder | Not production transaction-safe | SQL RPC updating community owner, roles/members, and audit log together. |
| Accept invite + increment uses + create member | Supabase Edge Function placeholder exists | Should be transactional in function | Keep invite accept behind Edge Function; update invite/member/audit atomically. |
| Role update + member permissions | Placeholder/future | Not enabled | SQL RPC with permission check and audit log. |
| Ban/kick member + audit log | Placeholder/future | Not enabled | SQL RPC/Edge Function with audit log inside transaction. |
| Upload attach to message | Attachment metadata can be pending | Partial | Link attachment to message in the message transaction or explicit attach RPC. |
| Notification creation + realtime emit | Placeholder/future | Not enabled | Create notifications inside transaction, emit realtime after commit. |

## Immediate safe decisions

- Do not implement destructive transaction RPCs until the UI flow is ready.
- Do not move simple MVP reads/writes into a backend layer prematurely.
- Treat current community creation as a partial MVP create path until owner membership/default roles are bundled.
- Keep attachment cleanup jobs for orphaned pending uploads.

## Future SQL RPC examples

Potential future functions:

- `public.create_community_with_defaults(name, description, accent_color, template_id)`
- `public.send_message_with_attachments(channel_id, body, client_message_id, attachment_ids)`
- `public.transfer_community_ownership(community_id, target_user_id, confirm_name)`
- `public.accept_invite_transaction(invite_code)`
- `public.moderate_member_action(community_id, target_user_id, action, reason)`

Each function should:

1. Validate auth and permissions through RLS-safe helpers.
2. Lock the smallest required rows.
3. Apply all related writes.
4. Add audit/account events where appropriate.
5. Return safe DTO fields only.

## Manual verification checklist

1. Create a community in mock mode and Supabase mode.
2. Confirm no partial destructive action is exposed in the desktop UI.
3. Send a message with and without attachments.
4. Confirm failed attachment metadata remains recoverable or cleanable.
5. Review Edge Function transaction boundaries before enabling invite accept in production.

## Known gaps

- Full default community creation is not yet atomic.
- Attachment-to-message linking is not yet a single transaction.
- Ownership transfer and moderation actions remain placeholders.
- Audit logs are not yet attached to all privileged operations.
