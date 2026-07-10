# Production Webhook Foundation

## Status

Picom has a production-safe incoming webhook delivery foundation. Delivery remains fail-safe disabled unless the Edge Function environment explicitly sets `PICOM_WEBHOOK_DELIVERY_ENABLED=true`. No secret or production URL is committed.

## Management UI

Community Admin > Webhooks supports permission-gated create, metadata list, one-time URL display, clipboard copy, and revoke confirmation. The UI uses the service layer and does not select token hashes.

- Managers require `manageChannels`/owner-level authorization enforced by RLS.
- A 256-bit raw token is generated and shown only in the create result.
- Only SHA-256 hash is persisted.
- Revocation sets `revoked_at`; the raw token is unrecoverable.
- UI-created messages already display the `WEBHOOK` badge when webhook metadata is present.

## Delivery architecture

1. Caller sends `POST /functions/v1/webhook-message?id=<webhook-id>`.
2. Token is supplied only through `X-Picom-Webhook-Token`. Query-string credentials are rejected to avoid URL/history/proxy/log leakage.
3. Edge Function validates method, feature enablement, ID/token shape, body, size, and optional `Idempotency-Key`.
4. Token is SHA-256 hashed in memory; the raw value is never logged or passed to SQL.
5. Service-role client calls the backend-only `deliver_webhook_message` RPC.
6. The RPC atomically validates hash/revocation, channel-community relationship, text-channel type, creator's current manager access, idempotency, rate limit, message insert, and audit event.
7. Message is marked with immutable `webhook_id` and `webhook_name` snapshot fields.

The RPC is revoked from public/anon/authenticated roles and granted only to `service_role`. Renderer clients cannot call it directly.

## Request

```http
POST /functions/v1/webhook-message?id=<uuid>
X-Picom-Webhook-Token: <64-hex-token>
Idempotency-Key: deployment-2026-07-10-001
Content-Type: application/json

{"content":"Release completed successfully."}
```

Body is plain text content only, 1-2000 characters. Unsafe HTML is not rendered. Arbitrary username/avatar overrides, attachments, embeds, commands, and mentions are not accepted in v1.

## Authentication and token safety

- Tokens use cryptographically secure 256-bit randomness.
- Database stores only a 64-character SHA-256 hash with unique constraint.
- Authenticated column grants exclude `token_hash`.
- Raw tokens are never included in logging, diagnostics, analytics, audit reasons, abuse metadata, or responses after creation.
- The one-time URL must be treated as a password; preferred automation sends the token in the dedicated header to reduce URL-log exposure.
- Revoked tokens always fail with the same generic invalid response.

## Authorization and private channels

The RPC never trusts a caller-provided community/channel:

- It loads community/channel from the hashed webhook record.
- Channel must still belong to the same community and be a text channel.
- Webhook creator must still be community owner or a current member role with manager-level/`manageChannels` access.
- If access is removed, delivery fails generically.
- Private-channel messages remain protected by existing message SELECT RLS; no webhook response contains message content or community data.
- Authenticated users cannot spoof `webhook_id`/`webhook_name` through normal message insert/update policies.

## Rate limiting and idempotency

- Atomic limit: 30 requests per 60-second window per webhook.
- Limit state is backend-only with RLS and no anon/authenticated grants.
- Exceeded requests return `429 WEBHOOK_RATE_LIMITED` and `Retry-After`.
- Optional `Idempotency-Key` accepts 8-80 bounded characters.
- A repeated successful key returns the existing message without creating a duplicate.
- Final thresholds require production load/abuse review.

## Message and audit behavior

Successful delivery inserts:

- Human creator profile as the current schema's constrained author reference.
- Webhook ID and name snapshot, which cause the desktop `WEBHOOK` badge.
- A bounded client message ID for idempotency.
- Append-only `webhook_message` audit event without raw token or message content.

Message moderation triggers still validate blocked words, links, mentions, and slow mode. RPC and audit insert share one database transaction, preventing unaudited partial delivery.

## Failure states

- `503 WEBHOOK_DELIVERY_DISABLED`: explicit environment enablement missing.
- `401 WEBHOOK_INVALID`: invalid/revoked credential or unavailable/forbidden channel.
- `400 VALIDATION_ERROR`: malformed body or idempotency key.
- `429 WEBHOOK_RATE_LIMITED`: per-webhook window exhausted.
- `503 INTERNAL_ERROR`: provider/database path unavailable; no secret detail returned.

## Deployment gates

- Apply migration and run RLS/role tests in staging.
- Set service-role secret only in Supabase function secret storage.
- Explicitly set `PICOM_WEBHOOK_DELIVERY_ENABLED=true` only after review.
- Confirm token/hash fields never enter logs or diagnostics.
- Test revoked tokens, removed manager role, private channels, non-text channels, rate limits, idempotency, moderation trigger rejection, audit atomicity, realtime badge display, and kill-switch procedure.
- Monitor safe delivery/error counts without content or token labels.

## Exclusions

- No outgoing webhooks.
- No public webhook marketplace.
- No plugin runtime or arbitrary code execution.
- No attachment/embed delivery.
- No user/profile impersonation overrides.
- No secret recovery or token listing.
