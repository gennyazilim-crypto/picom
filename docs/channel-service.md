# Channel service

Task 147 adds the frontend channel data service boundary.

## File

```text
src/services/channelService.ts
```

## Responsibilities

- List channels for a community.
- Create a text or voice placeholder channel.
- Normalize channel names consistently.
- Preserve mock mode without Supabase.
- Use Supabase/RLS in Supabase mode.

## Data source behavior

- `mock`: maps channels from deterministic mock communities.
- `supabase`: queries `public.channels` with the anon client and relies on channel RLS.

## Security notes

The renderer does not bypass RLS. Supabase mode channel creation is allowed only if the current user passes the `channels_insert_owner` RLS policy.

## Manual test steps

1. In mock mode, call `channelService.listChannels("aurora")`.
2. Confirm channel summaries are returned.
3. Call `channelService.createChannel({ communityId: "aurora", name: "Team Chat" })` and confirm the name normalizes to `team-chat`.
4. In Supabase mode, sign in as a community owner and create a channel.
5. Confirm non-owner create attempts fail through RLS.
6. Run `npm run typecheck` and `npm run build`.