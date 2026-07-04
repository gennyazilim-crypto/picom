# ServerRail Supabase Data Mode

Task 158 connects the ServerRail community list to Supabase data mode.

## Behavior

- Mock mode continues to use local mock communities.
- Supabase mode loads communities after an authenticated session exists.
- `communityService.listCommunities()` remains the only data boundary used by the renderer.
- Loaded communities are converted into local desktop UI objects with `createCommunityFromSummary()`.
- ServerRail receives the updated community list through existing props.

## Environment variables

Supabase mode requires:

- `VITE_DATA_SOURCE=supabase`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do not commit real secrets. Use `.env.local` for local values.

## SQL and RLS

This task relies on the existing `public.communities` table and its RLS policies. The renderer uses the normal Supabase client and does not bypass RLS. Privileged service-role access is not used.

## Manual verification

1. Configure local Supabase env values in `.env.local`.
2. Start the app in Supabase mode.
3. Sign in with a seeded user.
4. Confirm ServerRail community icons match communities visible to that user through RLS.
5. Confirm mock mode still uses deterministic mock communities when `VITE_DATA_SOURCE=mock`.