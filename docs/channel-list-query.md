# Channel list query

Task 148 extracts the channel list query into a dedicated query module.

## File

```text
src/services/channelListQuery.ts
```

## Responsibilities

- Define the Supabase channel list select string.
- Map Supabase channel rows into `ChannelSummary` DTOs.
- Map deterministic mock channel data into the same DTO shape.
- Keep `channelService` focused on data source orchestration, validation, and errors.

## Query shape

The Supabase query selects:

```text
id, community_id, category_id, name, type, topic, is_private, position, created_at, updated_at
```

It filters by `community_id` and orders by `position`, then `created_at`.

## Data source behavior

- Mock mode uses `listMockChannelSummaries(communityId)`.
- Supabase mode uses `listSupabaseChannelSummaries(client, communityId)` and relies on channel RLS.

## Manual test steps

1. Run `npm run typecheck`.
2. Run `npm run build`.
3. In mock mode, call `channelService.listChannels("aurora")` and confirm deterministic channel summaries are returned.
4. In Supabase mode, call `channelService.listChannels(communityId)` while signed in and confirm RLS limits private/unrelated channels.