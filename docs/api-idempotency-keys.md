# API Idempotency Keys

Picom uses idempotency keys to reduce duplicate operations caused by double-clicks, reconnect retries, offline queue flushes, and desktop clients resending a request after a timeout.

## Current implementation level

- Message sending already uses `clientMessageId` to avoid duplicate persisted messages and realtime echoes.
- The shared API contract now defines `Idempotency-Key` and safe operation names for future HTTP and Edge Function endpoints.
- The renderer has `idempotencyKeyService` for generating, validating, and attaching idempotency headers.
- Supabase table writes that do not accept custom request headers should keep using database constraints or stable client-generated IDs until a server-side idempotency table is added.

## Header

```http
Idempotency-Key: picom:create_channel:client-generated-id
```

Keys are not secrets. They must still be redacted from noisy logs when they are not needed for debugging.

## Operations covered

- `send_message`
- `create_community`
- `create_channel`
- `upload_attachment`
- `accept_invite`
- `create_invite`
- `create_webhook`

## Client rules

- Generate one stable key per risky user action.
- Reuse the same key when retrying the same action.
- Do not reuse a key for a different action or different request body.
- Safe `GET`, `HEAD`, and `OPTIONS` requests may retry without an idempotency key.
- Unsafe `POST`, `PATCH`, and `DELETE` requests should only retry automatically when an idempotency key is present or the action has another stable duplicate-prevention key such as `clientMessageId`.
- Login/register should not be retried aggressively.
- Upload retries should remain user-controlled unless the upload provider supports resumable/idempotent uploads.

## Backend rules

Future server-side idempotency support should store short-lived records:

```ts
type IdempotencyRecord = {
  id: string;
  keyHash: string;
  operation: string;
  userId: string;
  requestFingerprint: string;
  status: "pending" | "succeeded" | "failed" | "expired";
  response?: unknown;
  createdAt: string;
  expiresAt: string;
};
```

The backend should:

- Hash the raw key before storing it.
- Bind records to the authenticated user and operation.
- Compare a request fingerprint before returning a previous result.
- Return the previous successful result when the same user repeats the same key and same request.
- Reject or warn when the same key is reused with a different request body.
- Expire records after a short retention window.
- Keep permission checks, Supabase RLS, and validation active on the original request.

## Existing message path

Messages should continue to use `clientMessageId` as the primary duplicate-prevention mechanism:

- The `messages_author_client_message_unique` constraint prevents duplicate persisted messages for the same author/client id.
- Realtime reconciliation uses message id and `clientMessageId` to avoid duplicate UI rows.
- Offline queue conflict handling maps duplicate client message errors to a recoverable state.

When a future HTTP/Edge Function message endpoint is added, it can accept both:

- `Idempotency-Key` header for request replay safety.
- `clientMessageId` body field for message-domain reconciliation.

## UI expectations

- Risky create/send buttons should disable while the first request is pending.
- Failed idempotent actions should show retry/remove options where useful.
- Retried successful actions should not create duplicate communities, channels, messages, uploads, invites, or webhooks.
- User-facing errors should remain friendly and should not expose raw database conflict details.

## Security notes

- Idempotency keys are not authorization.
- Idempotency keys do not replace permission checks.
- Frontend-only duplicate prevention is not enough for production write paths.
- Do not store passwords, session values, invite secrets, webhook secrets, or object storage credentials in idempotency records.

## Current TODOs

- Add a server-side idempotency table or Edge Function wrapper when HTTP APIs become stable.
- Add contract tests for repeated create/send calls once the backend route layer exists.
- Add idempotency key propagation to upload and invite creation services when those APIs are enabled.

