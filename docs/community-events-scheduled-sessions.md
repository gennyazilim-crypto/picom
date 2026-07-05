# Community Events and Scheduled Sessions Foundation

Status: post-MVP foundation

Community events and scheduled sessions are planned as a future layer for announcements, voice sessions, meetings, and community activities. This foundation documents the safe Supabase and LiveKit path without adding runtime UI to the MVP desktop app.

## MVP stance

- Scheduled community events are not enabled in the current MVP runtime.
- Existing community, channel, message, and LiveKit voice room behavior remains unchanged.
- No calendar integrations, public discovery listings, or automated reminders are introduced yet.

## Future data model placeholder

A future `community_events` table can use safe fields:

- `id`
- `community_id`
- `channel_id` optional
- `title`
- `description`
- `starts_at`
- `ends_at` optional
- `event_type` such as `voice_session`, `meeting`, `announcement`, `social`
- `created_by_id`
- `created_at`
- `updated_at`
- `cancelled_at`

A future `community_event_rsvps` table can use:

- `id`
- `event_id`
- `user_id`
- `status` such as `interested`, `going`, `not_going`
- `created_at`
- `updated_at`

## Supabase Auth and RLS expectations

- All event reads require authenticated session and community access.
- Private channel events require private channel visibility.
- Creating/editing/canceling events requires a permission such as `manageEvents` or `manageCommunity`.
- RSVP writes require membership in the target community.
- Expired or revoked sessions must fail safely and return an auth/session error, not partial event data.

## Scheduled LiveKit session placeholder

For future voice sessions:

- Event can reference a channel or voice room placeholder.
- LiveKit token Edge Function remains the authority for joining actual rooms.
- Event visibility must not grant voice access by itself.
- Joining a scheduled voice session still requires channel permission and a valid Supabase session.

## Future UI surfaces

Potential desktop UI entry points:

- CommunitySidebar Events item, hidden behind a future flag
- Community Settings > Events
- Create Event modal
- Event detail modal/popover
- RSVP controls
- Reminder notification placeholder

These surfaces should remain compact and desktop-native with no mobile bottom sheets.

## Notification placeholder

Future event reminders should respect:

- notification settings
- DND
- muted community/channel settings
- quiet hours
- revoked/expired sessions

Reminder logs must never include passwords, auth tokens, authorization headers, or private event details beyond safe metadata.

## Validation rules

- Title is required and bounded.
- Start time is required.
- End time must be after start time when provided.
- Description is bounded.
- Channel must belong to the community when provided.
- Cancelled events should remain available for audit/history where appropriate.

## Audit and privacy

Audit entries for event changes should store safe metadata only:

- event id
- community id
- actor id
- action
- timestamp

Do not log passwords, tokens, authorization headers, raw session values, or unnecessary private descriptions.

## Feature flag behavior

A future `enableCommunityEvents` flag should hide entry points while disabled. Backend RLS and permissions remain mandatory; feature flags are not security enforcement.

## Implementation decision

This task is documentation-first. Runtime event UI, Supabase migrations, and LiveKit scheduling behavior are intentionally deferred to avoid destabilizing MVP chat and voice flows.

## Manual verification

- Confirm existing voice room behavior still works.
- Confirm no new events UI appears in the current desktop shell.
- Confirm this document is used before future event schema/runtime implementation.
