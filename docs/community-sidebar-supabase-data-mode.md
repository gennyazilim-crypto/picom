# CommunitySidebar Supabase Data Mode

Task 159 connects the CommunitySidebar category/channel structure to Supabase data mode.

## Behavior

- Mock mode keeps using local mock category/channel data.
- Supabase mode loads categories and channels for the active community after sign-in.
- Categories are loaded through `channelCategoryService.listCategories()`.
- Channels are loaded through `channelService.listChannels()`.
- The renderer still receives a desktop UI `Community` object, so the existing four-column layout remains unchanged.

## RLS and security

The renderer uses only the normal Supabase client. It does not bypass RLS and does not use service-role credentials. Supabase policies on `channel_categories` and `channels` decide which categories/channels are visible.

## Environment variables

Supabase mode requires:

- `VITE_DATA_SOURCE=supabase`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use `.env.local` for local values. Do not commit secrets.

## Manual verification

1. Start the app with Supabase mode enabled.
2. Sign in as a seeded user.
3. Select a community in ServerRail.
4. Confirm CommunitySidebar loads that community's categories and channels from Supabase.
5. Confirm mock mode still shows deterministic local sidebar data.