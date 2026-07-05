# Trust and safety dashboard placeholder

Picom will need a restricted Trust and Safety dashboard for app operators to review safety signals without exposing secrets, private data, or normal-user admin surfaces. This document defines the placeholder scope before any production dashboard is enabled.

This is separate from community settings. It is app/operator tooling and must remain hidden from normal users.

## Goals

- Centralize high-level safety signals for app operators.
- Help identify abuse, suspicious uploads, repeated failed actions, and moderation backlog.
- Keep normal community admins separate from app-level trust and safety operators.
- Avoid exposing raw private messages, tokens, passwords, cookies, authorization headers, or service secrets.
- Preserve audit log integrity for review actions.

## Non-goals for MVP

- No production trust and safety console is enabled by this task.
- No mobile UI.
- No automated moderation decisions.
- No real analytics provider integration.
- No raw private message review outside explicit moderation context.
- No service-role Supabase access in the renderer.

## Future dashboard sections

Initial restricted dashboard sections may include:

- open reports
- moderation appeals
- suspicious uploads and quarantine counts
- rate limit events
- repeated failed login signals
- webhook abuse placeholder
- invite abuse placeholder
- blocked words hits placeholder
- recent bans and kicks
- recent server errors summary
- audit log health summary

Each section should show counts, timestamps, and safe identifiers first. Deep links should require permission checks and RLS-backed access.

## Data safety rules

The dashboard must not show:

- passwords
- auth tokens
- cookies
- authorization headers
- Supabase service-role keys
- LiveKit secrets
- signing keys
- raw private channel content unless the operator has approved moderation context
- unredacted IP addresses before privacy policy review
- full storage object paths for private/quarantined files

Allowed safe metadata examples:

- event type
- user id or redacted user reference
- community id
- channel id if visible to the operator
- attachment id
- report id
- appeal id
- redacted request id
- timestamp
- status enum
- risk level enum

## Future Supabase/service boundary

Future dashboard data should be served by trusted Edge Functions or backend routes, not direct renderer queries with elevated access.

Potential route placeholder:

- `GET /admin/trust-safety/summary`

The route should:

- require authenticated app-admin/operator permission
- return aggregate counts by default
- redact sensitive metadata
- never expose service-role secrets
- avoid returning raw private content
- log access to trust and safety data in immutable audit logs

## RLS and authorization expectations

- Normal users cannot view trust and safety summaries.
- Community moderators cannot access app-level trust and safety views unless explicitly promoted to app operator.
- Community owners may view their own community moderation queues, not global safety signals.
- App admins/operators require a distinct app-level authorization flag or role.
- The renderer may only call safe service methods and must not contain privileged keys.

## UI placeholder plan

Future desktop UI should live under an app-admin-only entry point, likely inside Admin Operations.

Desktop layout expectations:

- premium modal or admin view, not a mobile sheet
- compact metric cards
- filtered safety event list
- clear placeholder states when backend routes are unavailable
- light/dark design token support
- Coolicons through `AppIcon`
- no Discord branding/assets/colors

If the user is not an app admin:

- do not show the entry point
- do not expose hidden data in DOM state
- show a safe permission denied message only for direct/deep-linked attempts

## Audit requirements

The following should create immutable audit entries once audit logs are implemented:

- trust and safety dashboard opened
- report reviewed
- appeal reviewed
- suspicious upload reviewed
- rate limit event escalated
- ban/kick decision changed
- safety export requested

Audit metadata must be redacted and must not store secrets or raw private content.

## Abuse prevention and privacy

- Avoid analytics-style collection of message content.
- Prefer aggregate counts for dashboard summaries.
- Limit access to detailed report context.
- Rate limit dashboard queries.
- Keep support exports separate from dashboard access.
- Document operator access reviews before production.

## MVP status

- Admin Operations already contains limited placeholder safety cards for reports/rate-limit style signals and attachment quarantine counts.
- A dedicated production Trust and Safety dashboard is not enabled yet.
- This document defines the future dashboard scope, access boundaries, and safe data rules.
- Any runtime implementation must preserve the existing desktop MVP UI and use Supabase RLS/trusted service boundaries.
