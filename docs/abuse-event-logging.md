# Abuse Event Logging

Picom records abuse-related signals through a centralized service so safety investigations can happen without storing passwords, tokens, raw authorization headers, cookies, or private message content.

## Current status

- `abuseEventService` is a local/in-memory foundation for the desktop MVP.
- Events are routed through `loggingService`, which redacts sensitive metadata.
- Admin Operations shows only an aggregate local placeholder summary.
- No backend admin route is publicly exposed by this task.

## Event types

- `repeated_failed_login`
- `rate_limit_exceeded`
- `upload_rejected`
- `webhook_rate_limit`
- `invite_abuse_placeholder`
- `blocked_words_hit`
- `suspicious_attachment`
- `unauthorized_private_channel_access`
- `invalid_deep_link_abuse_placeholder`

## Safe metadata

Allowed metadata examples:

- user id placeholder
- community id
- channel id
- target id
- request id
- hashed IP placeholder
- short reason
- event type
- timestamp

Do not store:

- passwords
- auth tokens
- cookies
- authorization headers
- raw IP addresses
- message content
- attachment file contents
- private secrets

## User-facing UX

The service exposes safe user messages for common blocks, while developer diagnostics stay in redacted logs.

Examples:

- Rate limit: "You are doing that too quickly. Please wait a moment and try again."
- Suspicious upload: "This upload could not be accepted for safety reasons."
- Private channel access: "You do not have access to that private channel."

## Future Supabase implementation

When backend abuse logging is enabled:

1. Add an `abuse_events` table with RLS restricted to app admins or trusted Edge Functions.
2. Insert events only from trusted backend paths or reviewed Edge Functions.
3. Keep message content out of abuse events; use message ids and moderation context instead.
4. Return only redacted summaries to Admin Operations.
5. Audit app-admin access to abuse event views.

## Verification

Run:

```powershell
npm run abuse:events:smoke
```

The smoke test verifies redaction, private-content exclusions, admin summary wiring, and developer/user message separation.
