# MessageList Supabase Data Mode

Task 160 connects the MessageList data source to Supabase mode.

## Behavior

- Mock mode keeps using local mock messages.
- Supabase mode loads messages for the active community/channel after sign-in.
- Messages are loaded through `messageService.listMessages()`.
- The app maps safe `MessageSummary` DTOs into the existing desktop UI message shape.
- The chat layout, sidebars, pinned composer, and independent scroll behavior remain unchanged.

## Pagination

The initial connection loads the first page through the pagination placeholder introduced in Task 152. Loading older messages is intentionally deferred to a later UI task.

## RLS and security

The renderer uses the normal Supabase client and does not bypass RLS. Supabase message policies decide which channel messages are visible. Private channel access must remain enforced by RLS.

## Environment variables

Supabase mode requires:

- `VITE_DATA_SOURCE=supabase`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use `.env.local` for local values. Do not commit secrets.

## Manual verification

1. Start the app in Supabase mode.
2. Sign in as a seeded user.
3. Select a community and text channel.
4. Confirm MessageList loads messages from Supabase for that active channel.
5. Switch channel and confirm the new channel loads its message page.
6. Confirm mock mode still shows local mock messages.