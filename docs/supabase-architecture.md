# Supabase-First Backend Architecture Decision

Picom MVP uses Supabase as the primary backend platform for authentication, database, storage, realtime updates, and privileged server-side workflows.

## Decision

Use Supabase primitives first:

- Supabase Auth for account identity and sessions.
- Supabase Postgres for app data.
- Row Level Security (RLS) for client-visible data boundaries.
- Supabase Storage for uploaded media and attachments.
- Supabase Realtime for messages, presence-style updates, and subscription-ready data changes where appropriate.
- Supabase Edge Functions for privileged actions that cannot safely run from the desktop client.

## Security boundary

The desktop client is never trusted with privileged database access.

- Client-side access must use the public anon key only.
- RLS must be enabled on user/community/message-facing tables.
- Service role keys must never be bundled into Electron renderer, preload, or frontend assets.
- Any service-role operation must run in a controlled backend context such as an Edge Function.
- Edge Functions should be used only when the action is truly privileged or cannot be represented safely with RLS.

## Initial Supabase areas

### Auth

- Email/password or configured providers for MVP auth.
- Session state kept through Supabase client in a desktop-safe service layer.
- Renderer components call app services, not raw auth primitives directly where a service abstraction exists.

### Postgres

Expected MVP tables will be documented in later schema tasks, including:

- profiles
- communities
- community_members
- roles
- channels
- messages
- attachments
- reactions
- read_states
- invites
- notifications

### RLS

Every table with user/community data must document:

- who can select rows
- who can insert rows
- who can update rows
- who can delete rows
- which community/channel membership checks are required

Private channel and community isolation must be enforced by RLS or a justified Edge Function, not only by frontend hiding.

### Storage

Supabase Storage is the default MVP storage path for attachments and avatars.

Required decisions for later tasks:

- bucket names
- public vs private buckets
- signed URL strategy
- upload size limits
- MIME/type validation
- RLS or policy boundaries for storage objects

### Realtime

Supabase Realtime should be used for MVP message updates if it satisfies reliability and access-control requirements. Realtime subscriptions must respect authenticated user context and must not expose private channel data.

### Edge Functions

Use Edge Functions for:

- privileged invite logic when RLS cannot express the flow safely
- server-side moderation or admin actions
- LiveKit token generation
- upload post-processing placeholders if needed
- any action requiring secrets

## Environment variables

Frontend/desktop renderer-safe variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ENV`
- `VITE_DATA_SOURCE`

Privileged server/Edge Function variables:

- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never renderer)
- `LIVEKIT_API_KEY` (server-only)
- `LIVEKIT_API_SECRET` (server-only)
- `LIVEKIT_URL`

## Required future SQL documentation

Later schema tasks should create SQL migration files or docs for:

- table definitions
- indexes
- foreign keys
- RLS enablement
- policies
- storage bucket policies
- seed data for local development

## Test expectations

For every Supabase-backed feature, test at least:

- authenticated access succeeds for allowed rows
- unauthenticated access fails
- non-member access fails
- private channel access fails without permission
- insert/update/delete policies match intended role permissions

## Current repository state

This task documents the backend decision only. No Supabase dependency or runtime client is added here because Phase A is focused on safety, scope, and architecture decisions before implementation.