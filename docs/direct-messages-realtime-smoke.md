# Direct Messages Two-Window Realtime Smoke Test

1. Apply migrations through `20260710003000_direct_messages_realtime.sql` to a non-production Supabase project.
2. Sign in as two users who share one direct conversation; keep a third non-member account available.
3. Open the same conversation in two packaged/dev Electron windows.
4. Send rapidly from both windows and verify each `client_message_id` appears exactly once and preserves server timestamps.
5. Edit and soft-delete from the author window; verify the other member receives the update and the outsider receives no row.
6. Add/remove a reaction and verify counts converge without duplicate events.
7. Leave one conversation inactive and verify its unread badge increments; opening it clears local unread state.
8. Focus the active conversation near the bottom and verify no desktop notification appears; background the app and verify settings/quiet-hours decide delivery.
9. Disconnect/reconnect network and verify channels are removed/recreated without duplicate subscriptions.
10. Inspect Supabase Realtime logs and confirm the non-member never receives DM payloads.

Do not use production accounts or private user content for this smoke test.
