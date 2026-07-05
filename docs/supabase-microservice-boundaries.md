# Supabase microservice boundaries

Task 195 defines Picom's Supabase-native backend boundaries for the Electron desktop MVP.

## Principle

The Electron renderer is an untrusted client. It may use Supabase Auth, Postgres, Storage, and Realtime through the anon key only. Any workflow that needs secrets, service-role access, privileged cross-user decisions, or third-party credentials must live behind a Supabase Edge Function or another trusted server boundary.

## Renderer + RLS boundary

These workflows should stay client-driven when RLS can express the rule safely:

- Sign in, sign up, sign out, and session refresh through Supabase Auth.
- Read the current user's profile.
- Update the current user's own safe profile fields.
- List communities visible to the signed-in user.
- Create communities when RLS creates or allows the owner/member relationship safely.
- List categories/channels visible to the user's membership and channel permissions.
- Fetch messages for visible channels.
- Send/edit/delete messages when message RLS and mutation policies enforce ownership or moderator rules.
- Add/remove reactions when RLS enforces member access.
- Read/update read states for the current user.
- Upload attachment objects only when Storage policies and attachment metadata policies can enforce ownership and channel access.
- Subscribe to realtime changes where the underlying table RLS limits row visibility.

## Edge Function boundary

Use Supabase Edge Functions for workflows that need privileged logic:

- LiveKit token generation.
- Invite creation/acceptance when use counts, expiration, or membership creation require atomic server-side checks.
- Moderation actions that affect another user.
- Admin/operator actions.
- Notification fanout if server-side routing is needed.
- Upload post-processing placeholders such as thumbnail generation, malware scanning, or quarantine review.
- Any workflow requiring `SUPABASE_SERVICE_ROLE_KEY`.
- Any workflow requiring third-party secrets such as LiveKit, email, or future payment/provider keys.

## Boundary decision matrix

| Workflow | Preferred boundary | Reason |
| --- | --- | --- |
| Login/register/logout/session restore | Supabase Auth from renderer | Supabase Auth client is designed for anon-key usage. |
| Current profile read/edit | Renderer + RLS | User can only access their own safe profile fields. |
| Community/channel/message reads | Renderer + RLS | Membership and private-channel visibility should be enforced by policies. |
| Message send/edit/delete own message | Renderer + RLS | Ownership and member permissions should be enforced by policies. |
| Moderator delete / cross-user moderation | Edge Function | Requires audited privileged decision making. |
| Invite acceptance | Edge Function | Needs atomic validation, expiry/use count checks, and membership creation. |
| LiveKit voice/screen token | Edge Function | Requires server-only LiveKit API credentials. |
| Notification fanout | Edge Function | Server-side recipient routing and user preference checks. |
| File metadata validation | Edge Function or shared client validation | Edge Function prepares a server-side validation boundary; Storage/RLS remain required. |
| Health check | Public Edge Function | Non-sensitive operational status only. |

If a workflow does not clearly need secrets, cross-user privilege, or atomic multi-step server logic, keep it in direct Supabase/RLS first.

## Service-role usage policy

`SUPABASE_SERVICE_ROLE_KEY` is allowed only inside trusted server boundaries and only after the task documents:

- Why caller-scoped RLS access is insufficient.
- Which tables/actions need elevated access.
- How authorization is checked before elevated access.
- What audit/log entry is written.
- Which sensitive fields are excluded from responses and logs.

Never expose service-role keys to Electron renderer, preload, Vite env variables, diagnostics export, screenshots, or logs.

## Not a microservice boundary

Do not create Edge Functions just to bypass inconvenient RLS. Prefer table policies and helper SQL functions when the rule is data-local, auditable, and safe for the anon client.

Avoid Edge Functions for:

- Simple community/channel/message reads.
- Basic message send if RLS can enforce membership and permission.
- Basic profile update for the current user.
- Theme/settings persistence that can remain local or user-scoped.

## Required SQL and policies

For each client-visible table:

- Enable RLS.
- Add select policies scoped to membership and channel visibility.
- Add insert/update/delete policies scoped to ownership and permission.
- Keep reusable membership checks in SQL helper functions.
- Do not create broad anon policies.

For realtime tables:

- Add only required tables to `supabase_realtime`.
- Confirm RLS policies prevent private/unrelated row leakage.

For storage:

- Use private buckets by default for message attachments.
- Store metadata in Postgres.
- Keep Storage object policies aligned with message/channel visibility.

## Environment variables

Renderer-safe:

```env
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Server/Edge Function only:

```env
SUPABASE_SERVICE_ROLE_KEY=...
LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

Never add server-only values to Vite-prefixed variables.

## Test checklist

- Sign in with a normal member account and confirm allowed reads succeed.
- Confirm unauthenticated data reads fail.
- Confirm a non-member cannot read another community.
- Confirm a user cannot read private-channel messages without access.
- Confirm normal message send works without service-role credentials.
- Confirm privileged operations fail from the renderer unless routed through a documented Edge Function.
- Confirm logs, diagnostics, and docs do not expose service-role keys or provider secrets.

## Review checklist for new backend work

- Can RLS enforce this safely without a function?
- Does the operation touch another user's data?
- Does the operation need a third-party secret?
- Does the operation need a transaction or atomic counter?
- Does the renderer need only a sanitized DTO?
- Is there a rollback path if the function fails?
- Are staging/local test steps documented?

## Current MVP decision

The MVP should use direct Supabase client access only for RLS-protected user/community/channel/message/storage flows. Edge Functions are reserved for LiveKit token generation and future privileged workflows, not for hiding incomplete policy design.
