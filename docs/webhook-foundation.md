# Webhook Foundation

Status: post-MVP foundation

Picom webhooks are planned as a future channel integration surface. This document keeps the architecture explicit without enabling production webhook behavior during the Full MVP.

## Goals

- Allow external systems to send messages into approved Picom channels later.
- Keep webhook management permission-protected.
- Keep tokens safe and only shown once at creation time in a future implementation.
- Support rate limiting and audit logging before any public send endpoint is enabled.
- Preserve the current desktop MVP UI while the feature remains disabled.

## Non-goals for MVP

- No production webhook endpoint is exposed in the desktop MVP.
- No bot marketplace or plugin runtime is introduced.
- No arbitrary code execution is allowed.
- No unsafe token display, token logging, or token analytics are allowed.
- No message content is sent to analytics.

## Future data model placeholder

A future `webhooks` table can use safe DTO fields only:

- `id`
- `community_id`
- `channel_id`
- `name`
- `avatar_url`
- `token_hash`
- `created_by_id`
- `created_at`
- `updated_at`
- `revoked_at`

The raw webhook token must never be stored. Store only a secure hash and show the raw value exactly once after creation.

## Future routes placeholder

Potential API routes, all behind permissions and rate limits:

- `GET /channels/:channelId/webhooks`
- `POST /channels/:channelId/webhooks`
- `PATCH /webhooks/:webhookId`
- `DELETE /webhooks/:webhookId`
- `POST /webhooks/:webhookId/:token`

These routes should not be enabled until Supabase RLS, server-side validation, abuse logging, and rate limiting are ready.

## Permissions

Managing webhooks should require one of the following future permissions:

- `manageWebhooks`
- `manageChannels`
- owner/admin override

Sending through a webhook should validate:

- webhook exists
- webhook is not revoked
- target channel exists
- channel belongs to the webhook community
- webhook token hash matches
- channel accepts webhook messages

## Token safety

- Generate webhook tokens with a cryptographically secure random source.
- Store only `token_hash`.
- Redact token-like values in logs and diagnostics.
- Never include webhook tokens in analytics or support exports.
- Copy URL actions must go through the existing clipboard abstraction when UI is added later.

## Message safety

Webhook messages should be clearly marked as webhook/bot-originated messages in future UI. Payload validation should reject:

- empty content and empty attachment payloads
- oversized payloads
- unsupported attachment MIME types
- unsafe URLs or unsupported protocols
- excessive mentions

## Rate limiting and abuse prevention

Webhook send endpoints should have a stricter rate limit than normal user messages. Abuse events should record safe metadata only:

- webhook id
- community id
- channel id
- requester IP hash placeholder
- event type
- timestamp
- reason

Do not store raw message content in abuse analytics.

## Desktop UI placeholder

Future UI entry point:

- Channel Settings > Webhooks
- Create webhook modal
- Copy webhook URL through clipboardService
- Revoke webhook confirmation

For MVP, these entry points should remain hidden or clearly marked disabled by feature flags.

## Implementation decision

This task is documentation-only. Runtime code is intentionally unchanged so the MVP desktop chat flow stays stable.

## Manual verification

- Confirm no new webhook UI appears in the desktop shell.
- Confirm existing community/channel/message flows are unchanged.
- Confirm this document explains future permissions, token safety, and rate limits.
