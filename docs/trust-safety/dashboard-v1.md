# Trust & Safety Dashboard v1

## Purpose

The Picom Trust & Safety Dashboard centralizes aggregate safety signals for app operators. It is an app-level operational view, not a replacement for community moderation queues or a general analytics dashboard.

## Access

The dashboard is hosted inside the guarded Admin Operations view and is available only when:

- The build is a development build with explicit development access, or
- The current authenticated account passes the protected `is_app_admin` RPC.

Normal users receive no entry point. Community Owner/Admin/Moderator roles do not automatically grant app-wide safety access.

A future moderator dashboard must be separately community-scoped, enforce membership and moderation permissions in the backend/RLS, and return only records for authorized communities/channels.

## V1 sections

### Open reports

- Displays the aggregate open-report count from `reportService`.
- Does not display report description, reporter identity, target content, or private message text.

### Recent bans and kicks

- Explicit placeholders in v1.
- Remain zero until a protected backend moderation-action summary exists.
- Must not be populated from untrusted renderer state.

### Rate-limit events

- Displays the aggregate `rate_limit_exceeded` abuse-event count.
- Does not expose request payloads, raw IP addresses, or per-user timelines.

### Upload rejects and suspicious attachments

- Displays aggregate `upload_rejected` and `suspicious_attachment` counts.
- Displays quarantine/review placeholder counts.
- Does not expose raw file paths, signed URLs, storage credentials, attachment content, or scanner output.

### Blocked-word hits

- Displays only the aggregate `blocked_words_hit` count.
- The matched word and message content are not shown or retained by this dashboard.

### Failed-login signals

- Displays only the aggregate `repeated_failed_login` count.
- Does not expose credentials, authorization headers, email addresses, session IDs, or raw IP addresses.

### Severity summary

- Aggregate critical, warning, and total abuse-event counts.
- No raw event reason/metadata appears in the v1 UI.

## Data sources

The current dashboard reads safe aggregates from existing service abstractions:

- `reportService.getSummary()`.
- `abuseEventService.getAdminSummary()` category totals.
- `attachmentQuarantineService.getAdminSummaryPlaceholder()`.
- Safe Supabase configuration status from diagnostics.

These are local/session-bounded or placeholder values. They are not presented as complete production history.

## Privacy and security boundary

The dashboard must not display or export:

- Private message, reply, profile, attachment, voice, or report-description content.
- Passwords, password hashes, tokens, cookies, authorization headers, service-role keys, or LiveKit secrets.
- Raw IP addresses, email addresses, session IDs, invite secrets, or private storage paths.
- Reporter identity, target identity, or user-level behavior unless a future authorized moderation case explicitly requires it.
- Arbitrary abuse-event metadata or provider payloads.

Frontend access checks are not security enforcement. Future APIs must validate app-admin or scoped moderator permissions server-side and use RLS where applicable.

## Mutation policy

V1 is read-only. It does not:

- Ban, kick, timeout, or modify users.
- Resolve/dismiss reports.
- Release/delete quarantined attachments.
- Change rate limits or blocked-word policies.
- Query private content.

Before adding mutations, Picom requires permission checks, confirmation UX, append-only audit events, idempotency, safe error codes, and backend transaction boundaries.

## Future backend path

A protected endpoint may later return a schema such as:

```text
GET /admin/trust-safety/summary
```

The response should contain aggregate counts, freshness timestamp, environment, and bounded categories only. Detailed moderation cases should use separate least-privilege endpoints and explicit authorization.

## Known limitations

- Counts reset with local runtime state unless backed by Supabase later.
- Bans and kicks are placeholders.
- Quarantine counts are placeholders until scanner/storage metadata is persisted.
- Failed-login spike detection needs a backend time window and privacy-safe IP handling.
- No production alerting or external safety provider is enabled.

