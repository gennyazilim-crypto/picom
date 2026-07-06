# Supabase Core Integration

Picom keeps Supabase access behind service modules so the Electron renderer UI does not call database tables directly.

## Data source modes

- `VITE_DATA_SOURCE=mock` keeps the desktop UI fully usable without Supabase.
- `VITE_DATA_SOURCE=supabase` enables Supabase Auth, Postgres, Storage, and Realtime service paths.

The data source switch is centralized in `src/services/dataSourceService.ts`.

## Renderer-safe configuration

Renderer-safe values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-only values:

- `SUPABASE_SERVICE_ROLE_KEY`
- database passwords
- JWT secrets
- LiveKit API key/secret

Server-only values must never be prefixed with `VITE_` and must never be imported into React components.

## Client entrypoints

- `src/services/supabase/supabaseClient.ts` owns the actual Supabase client singleton.
- `src/lib/supabaseClient.ts` is a compatibility entrypoint for future imports.

## Services

- Auth: `src/services/authService.ts`
- Profile: `src/services/profileService.ts`
- Communities: `src/services/communityService.ts`
- Channels: `src/services/channelService.ts`
- Members: `src/services/membersService.ts`
- Messages: `src/services/messageService.ts`
- Reactions: `src/services/reactionService.ts`
- Uploads: `src/services/uploadService.ts`
- Attachment metadata: `src/services/attachmentService.ts`
- Realtime helpers: `src/services/supabase/realtimeService.ts`

`src/services/supabase/*Service.ts` wrapper files re-export the core services for a stable Supabase namespace without duplicating business logic.

## Core flow coverage

Auth:

- register via `auth.signUp`,
- login via `auth.signInWithPassword`,
- session restore via `auth.getSession`,
- logout via `auth.signOut`,
- no null session crash path through typed `AuthServiceResult`.

Profiles:

- current profile fetch,
- profile fetch by ID,
- current profile update through RLS.

Communities/channels:

- list communities visible through RLS,
- create communities owned by the current user,
- list visible channels,
- create channels through RLS-protected channel service,
- active channel fallback remains in app state.

Messages:

- list messages with cursor-shaped response,
- send messages with `clientMessageId`,
- edit/delete through message service where RLS allows,
- optimistic reconciliation remains a renderer/store concern.

Uploads:

- validate image files before upload,
- upload to the private `message-attachments` bucket,
- create pending attachment metadata separately,
- render paths remain RLS/storage-policy dependent.

Realtime:

- `subscribeToChannelMessages()` subscribes to active-channel `postgres_changes`,
- cleanup is returned as an unsubscribe function,
- status changes map to Picom realtime states,
- components should subscribe through hooks/services, not direct Supabase calls.

## Verification

Run:

```powershell
npm run supabase:api-regression
npm run supabase:smoke
npm run supabase:rls:smoke
npm run typecheck
npm run mock:smoke
npm run build
```

If Supabase CLI is unavailable, `supabase:rls:smoke` warns that live pgTAP RLS execution was skipped. That is not a real RLS pass; install Supabase CLI and run `npm run supabase:rls:test` for local execution.
