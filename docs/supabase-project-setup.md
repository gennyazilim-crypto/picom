# Supabase project setup guide

This guide prepares Picom for the MVP Supabase backend while keeping the current desktop app usable in mock mode.

## Scope

Picom will use Supabase for:

- Auth
- Postgres
- Row Level Security policies
- Storage for attachments and avatars
- Realtime for chat updates and presence placeholders
- Edge Functions only for privileged operations that must not run from the renderer

The renderer must never use service-role credentials.

## 1. Create the Supabase project

1. Create a new Supabase project for Picom.
2. Choose a region close to the expected beta users.
3. Keep the project name and database password outside source control.
4. Record only renderer-safe values in `.env.local`.

## 2. Local environment values

Copy `.env.example` to `.env.local`.

```env
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Keep mock mode available for offline UI work:

```env
VITE_DATA_SOURCE=mock
```

## 3. Auth configuration

Recommended MVP settings:

- Enable email/password auth for MVP testing.
- Disable public OAuth providers until product copy and redirect URLs are finalized.
- Configure desktop redirect URLs later if password reset/email verification deep links are added.
- Keep email verification optional until the MVP auth flow is fully tested.

## 4. Database schema plan

Core MVP tables should be created in SQL migration files before API mode is wired:

- `profiles`
- `communities`
- `community_members`
- `roles`
- `channels`
- `messages`
- `attachments`
- `message_reactions`
- `read_states`

Advanced roadmap tables should not be created yet unless the corresponding MVP task explicitly needs them.

## 5. RLS requirements

Enable RLS on every app table before exposing it to the renderer.

Minimum policy rules:

- Users can read their own profile and profiles visible through shared communities.
- Users can read communities where they are members.
- Users can read channels only when they can view that channel.
- Users can read messages only in visible channels.
- Users can insert messages only in channels where they have send permission.
- Users can update/delete only their own messages unless moderator permission exists.
- Storage objects must be scoped by community/channel visibility.

Never depend on frontend hiding alone for security.

## 6. Storage buckets

Suggested buckets:

- `attachments`
- `avatars`
- `community-icons`

Rules:

- Validate MIME type before upload.
- Enforce file size limits in client and backend/Edge Function paths.
- Use private buckets for anything that may belong to private channels.
- Public buckets may be used later only for non-sensitive avatars/icons.

## 7. Realtime setup

Realtime should initially cover:

- New message events.
- Message update/delete events.
- Reaction events.
- Typing placeholders.
- Presence placeholders.

Security notes:

- Clients should only subscribe to rooms they are authorized to view.
- Realtime payloads must not leak private channel messages.
- RLS and server-side checks remain the source of truth.

## 8. Edge Functions guidance

Use Edge Functions only for privileged or server-only operations, such as:

- Invite creation with secure tokens.
- Moderation actions requiring audit logs.
- LiveKit token generation later.
- Storage signing or scanning hooks later.

Do not put service role keys in the Electron renderer.

## 9. Test steps

1. Keep `VITE_DATA_SOURCE=mock` and confirm the desktop UI still runs.
2. Set `VITE_DATA_SOURCE=supabase` with project URL and anon key.
3. Confirm the app shows a clear connection state once Supabase clients are wired.
4. Create test auth users in Supabase.
5. Run SQL migrations once they exist.
6. Verify RLS by testing both allowed and denied users.
7. Confirm private channels are not visible to unauthorized users.

## 10. Production safety notes

- Store service-role keys only in server/Edge Function secret storage.
- Rotate keys if they are ever exposed.
- Keep SQL migrations reviewed and reversible where practical.
- Test RLS policies before beta builds.
- Keep mock mode separate from production API mode.
