# Webhook Abuse Protections

## Status

Picom incoming webhooks remain disabled unless `PICOM_WEBHOOK_DELIVERY_ENABLED=true`. The v1 endpoint accepts plain-text message delivery only; attachments, embeds, profile overrides, commands, and arbitrary metadata are rejected. This document complements [Production Webhooks](./production-webhooks.md).

## Enforced safeguards

| Control | Enforcement |
| --- | --- |
| Rate limit | Atomic database counter, 30 deliveries per webhook per 60 seconds; denial returns safe `429 WEBHOOK_RATE_LIMITED` and `Retry-After`. |
| Token storage | 256-bit token is shown once; only its SHA-256 hash is stored. Raw tokens are never logged or returned again. |
| Revocation | `revoked_at` invalidates delivery immediately and returns the same generic response as an unknown token. |
| Payload type | Endpoint requires `application/json` and a JSON object containing only `content`. |
| Body size | Request body is bounded to 16 KiB before parsing, including requests without `Content-Length`. |
| Message size | Trimmed content must contain 1-2000 characters; the database RPC repeats the same validation. |
| Attachments | Attachment URLs, embeds, binary data, impersonation fields, and arbitrary keys are rejected in v1. |
| Idempotency | Optional bounded `Idempotency-Key` prevents duplicate successful delivery. |
| Authorization | Backend-only RPC rechecks webhook state, creator access, community/channel relationship, and text-channel type. |
| Audit | Successful delivery appends a content-free `webhook_message` audit event in the same transaction. Create/revoke actions are audited separately. |

The Edge Function does not emit raw payloads, token values, authorization headers, or database exception details. Authenticated renderer clients cannot execute the delivery RPC or inspect rate-limit counters.

## Disabled and degraded states

- Global delivery kill switch: omit or set `PICOM_WEBHOOK_DELIVERY_ENABLED=false`.
- Per-webhook disable: revoke the webhook; token recovery is impossible, so re-enablement requires creating a new webhook.
- Removed manager access, deleted/non-text channel, or invalid credential fails generically without exposing community metadata.
- Database/provider failure returns a bounded `503` response. Clients should not retry aggressively.

## Spam detection placeholder

Content-aware spam scoring is intentionally not implemented. A production follow-up may evaluate repeated normalized payload hashes, cross-webhook bursts, moderation-filter hits, and delivery/error ratios. It must not persist raw message content or tokens, must avoid automatic punitive action without review, and must expose only safe aggregate signals to Trust & Safety operators.

## Operations and review

Monitor content-free counters for accepted, rate-limited, validation-rejected, revoked/invalid, and provider-failed requests. Alert on sustained rate-limit or validation spikes, rotate/revoke affected webhooks, use the global kill switch for systemic abuse, and preserve append-only audit integrity.

Before production enablement, test in staging:

- request 31 within one window and confirm safe `429`;
- revoke a token and confirm immediate generic denial;
- send wrong MIME, malformed JSON, more than 16 KiB, more than 2000 characters, and unsupported attachment/embed fields;
- remove creator manager access and change/delete the target channel;
- repeat an idempotency key and confirm one message;
- confirm logs, audit events, diagnostics, and responses contain no token or message body.

## Remaining risk

Live staging tests require Supabase CLI/provider access. Distributed edge traffic is protected by the database-atomic counter, but final thresholds and alerting need production traffic baselines. Automated spam detection and an operator review workflow remain intentional post-foundation work.
