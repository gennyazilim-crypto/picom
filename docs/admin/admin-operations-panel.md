# Admin Operations Panel v1

## Purpose

Admin Operations is Picom's restricted app-level health view. It supports development and system operations; it is not a community administration panel and does not grant community permissions.

## Access model

The view is rendered through `AdminOperationsView`, which requires an `AdminOperationsAccess` result with:

- `allowed: true`, and
- source `development` or `app_admin`.

`adminOperationsService.getAccess()` provides the guard:

- Development builds receive explicit dev-only access.
- Production-like Supabase builds call the protected `is_app_admin` RPC.
- Missing clients, RPC errors, false responses, and normal users fail closed to `source: none`.

The view has no normal-user ServerRail, community-menu, Mention Feed, or profile entry point. It currently appears only inside the existing Advanced settings surface after the guard succeeds.

Frontend hiding is defense in depth. Future admin data APIs must enforce the app-admin role independently through backend authorization/RLS and must not trust the renderer flag.

## Sections

### System status

- Access source.
- Mock/Supabase data-source mode.
- Network state.
- Supabase status and hostname only.
- LiveKit configured/not-configured status.
- Picom version and release channel.

### Observability

- Aggregate local counts for startup, auth, messaging, realtime, upload, LiveKit, screen share, RLS denial, crash, and abuse signals.
- Package and platform context.
- Explicit local/redacted sample-window label.

### Users and communities

- Mock/local visible entity counts only.
- No email, profile-private data, session, role token, or private content.

### Reports and abuse

- Aggregate report-state counts.
- Aggregate redacted abuse-event counts and severity summary.
- No raw IP or message content.

### Storage

- Attachment quarantine counts and a storage-health placeholder.
- No raw paths, object-storage credentials, signed URLs, or attachment content.

### Realtime

- Normalized realtime/network availability only.
- No room membership lists, payloads, tokens, or private channel names.

### Recent errors

- Bounded entries from `loggingService` after redaction.
- No raw stack/provider payload is exposed to normal users.

## Security and privacy rules

- Never expose passwords, tokens, cookies, authorization headers, service-role keys, LiveKit secrets, invite secrets, or signing credentials.
- Never include private message/attachment content unless a future, separately authorized moderation workflow explicitly requires and audits it.
- Avoid raw user IDs, email addresses, IP addresses, session IDs, room tokens, and filesystem paths.
- Use aggregate counts and normalized statuses wherever possible.
- Keep operations access separate from community Owner/Admin/Moderator roles.
- Log access-denied/backend failures through the redacted logging pipeline without revealing privilege data.

## Current limitations

- System metrics are local/session-bounded, not a production observability backend.
- Supabase, LiveKit, and storage health are configuration/status placeholders rather than active provider probes.
- The app-admin RPC must exist and be protected in the target Supabase environment.
- No remote administrative mutation actions are included in v1.
- There is no public or normal-user route to this panel.

## Future safe expansion

- Add a protected app-admin route only when the router and backend admin API are ready.
- Query aggregate backend health through a server-enforced app-admin endpoint.
- Add explicit audit events for sensitive operator actions before enabling mutations.
- Keep moderation content access in a distinct permissioned workflow.
- Require security review for every new data field or operation.

