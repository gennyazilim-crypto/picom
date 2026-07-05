# Moderation appeals placeholder

Picom will need a safe way for users to appeal moderation actions such as bans, kicks, message removals, timeouts, or future account-level restrictions. This MVP placeholder documents the architecture before any production appeals workflow is enabled.

This is not a legal policy and does not implement a final support process.

## Goals

- Give users a clear path to appeal moderation actions later.
- Keep appeals separated from normal community chat.
- Prevent normal users from seeing the moderation queue.
- Preserve audit log integrity for appeal decisions.
- Avoid exposing private messages, tokens, passwords, cookies, or internal secrets in appeal records.

## Non-goals for MVP

- No public legal/compliance claims.
- No automated appeal adjudication.
- No email/support desk integration yet.
- No mobile UI.
- No production moderator dashboard changes in this task.
- No destructive moderation reversal behavior without explicit future approval.

## Future Supabase model placeholder

Potential table: `moderation_appeals`

Suggested fields:

- `id uuid primary key`
- `community_id uuid null`
- `user_id uuid not null`
- `moderation_action_id uuid null`
- `reason text not null`
- `status text not null default 'open'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `reviewed_at timestamptz null`
- `reviewed_by_id uuid null`
- `decision_note text null`
- `metadata jsonb not null default '{}'::jsonb`

Allowed statuses:

- `open`
- `reviewed`
- `accepted`
- `denied`
- `closed`

Metadata must be redacted before storage.

## Future API/service placeholder

Future service methods should live behind a service layer, not direct component calls:

- `createAppeal(input)`
- `listCommunityAppeals(communityId)`
- `getAppeal(appealId)`
- `reviewAppeal(appealId, decision)`

Potential routes or Edge Functions:

- `POST /appeals`
- `GET /communities/:communityId/appeals`
- `PATCH /appeals/:appealId`

These endpoints must require Supabase Auth and RLS-backed permissions.

## RLS expectations

Future RLS policies should enforce:

- authenticated users can create appeals only for themselves
- users can view only their own appeal records unless they have moderation/admin permission
- community moderators/admins can view appeals only for communities they moderate
- moderators cannot review appeals for actions they are not permitted to manage
- normal users cannot update review status, reviewer, or decision fields
- app admins can view app-level appeals only after app-admin authorization exists

## UI placeholder plan

User-facing entry points may include:

- banned/kicked state screen: `Appeal action` button
- Settings > Privacy & Safety: `Appeal moderation action` placeholder
- error/permission denied state: safe appeal link only if relevant

Moderator/admin entry points may include:

- Community Settings > Moderation > Appeals tab
- Admin Operations / Trust & Safety summary placeholder

Appeal review UI should show:

- appeal status
- submitter safe profile summary
- target moderation action summary
- reason text
- redacted metadata
- timestamps
- reviewer decision controls

The review UI must not expose raw private messages beyond the moderation context the reviewer is permitted to access.

## Audit and logging requirements

Appeal lifecycle events should create immutable audit entries:

- appeal created
- appeal reviewed
- appeal accepted
- appeal denied
- appeal closed

Audit metadata must avoid:

- passwords
- auth tokens
- cookies
- authorization headers
- raw private message content unless a reviewed evidence policy exists
- Supabase service-role secrets
- LiveKit secrets

Renderer diagnostics should continue to use `loggingService` redaction. User-facing appeal errors should remain friendly and non-technical.

## Abuse prevention

Future implementation should include:

- per-user rate limits
- duplicate appeal detection for the same moderation action
- max reason length
- profanity/spam moderation placeholder
- attachment upload disabled unless specifically reviewed
- clear status feedback without promising a response time until support policy exists

## Open decisions

- Whether appeals are community-scoped only or can also be app-level.
- Whether a moderator can review an appeal for an action they originally took.
- Whether users can attach screenshots or logs.
- Retention period for denied/closed appeals.
- Whether appeal notifications are email, in-app, or both.

## MVP status

- Appeals are documented as a future placeholder.
- No production appeals endpoint is enabled yet.
- No appeals UI is exposed to normal users yet.
- Any future implementation must use Supabase Auth, RLS, service-layer calls, logging redaction, and immutable audit logs.
