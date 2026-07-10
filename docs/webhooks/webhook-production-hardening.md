# Webhook production hardening

## Management

- Community Settings > Webhooks remains gated by `manageChannels`/manager role UX.
- Supabase trusted create/revoke RPC repeats manager permission and channel/community/text-channel checks.
- Direct authenticated INSERT/UPDATE/DELETE grants and mutation policies are removed; clients cannot write/recover/replace `token_hash` directly.
- Trusted create generates 32 random bytes, returns the raw token once, and stores only SHA-256 hash.
- UI shows endpoint and token separately in transient state. The endpoint contains webhook ID only; token is copied separately and disappears on dismiss/community change/reload.
- Revoke is idempotent and append-only audited without token or message content.

## Delivery

- Edge Function is fail-safe disabled unless its explicit server environment switch is enabled.
- Only POST `application/json`, maximum 16 KiB, exact `{ content }` object, and 1–2,000 trimmed text characters are accepted.
- Token is accepted only in `X-Picom-Webhook-Token`; query parameter tokens are not supported.
- Webhook ID, token shape and optional idempotency key are strictly validated before RPC.
- Service-role backend sends only a token hash into backend-only delivery RPC.
- RPC verifies active webhook hash, current manager access, exact community/channel relation and text-channel type.
- Atomic 30 requests/60 seconds per webhook plus idempotency runs before insert.
- Message insert, immutable webhook name/ID marker and content-free audit occur transactionally.
- Normal authenticated users cannot set/edit webhook marker fields.

## Rendering and privacy

- Incoming payload is plain text only: no HTML, Markdown HTML, embeds, scripts, commands, attachments, profile overrides, metadata objects, remote images or executable content.
- Message UI uses normal safe text/link rendering and displays a clear `WEBHOOK` badge.
- Private-channel SELECT RLS remains unchanged; webhook delivery response contains IDs/status only, not message/private community content.
- Token/hash/header, message body, private channel/member context and service-role secret are forbidden from logs, diagnostics, audit reasons, analytics and abuse events.

## Manual verification

1. Member/moderator without manager permission cannot list/create/revoke or call RPCs.
2. Manager creates text-channel webhook; raw token appears once and database exposes hash to no client role.
3. Verify endpoint has no token/query secret and query-only token request returns generic invalid response.
4. Send valid header/plain text; verify one `WEBHOOK`-badged message in target channel.
5. Try wrong community/channel, voice/private unauthorized channel, revoked token, malformed token, extra JSON keys, HTML/embed/attachment payload, over-size body and overlong content.
6. Send 31 requests in window and verify safe 429/retry; retry same idempotency key and verify no duplicate.
7. Remove creator manager access and verify delivery fails closed.
8. Inspect logs/network/audit/diagnostics for token/hash/header/body leakage.

## Remaining blockers

- Live Supabase migrations/RPC/RLS/load testing; Edge deployment/config/secrets; distributed abuse monitoring; rotation; operational ownership; incident drill and external security review.
- Public webhook publishing/marketplace and outgoing webhooks remain disabled.
