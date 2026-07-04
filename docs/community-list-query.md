# Community list query

Task 144 extracts the community list query into a dedicated query module.

## File

```text
src/services/communityListQuery.ts
```

## Responsibilities

- Define the Supabase community list select string.
- Map Supabase community rows into `CommunitySummary` DTOs.
- Map deterministic mock communities into the same DTO shape.
- Keep `communityService` focused on data source orchestration and error handling.

## Query shape

The Supabase query selects:

```text
id, owner_id, name, description, icon_url, accent_color, created_at, updated_at
```

It does not load channels, members, messages, auth sessions, or secrets.

## Data source behavior

- Mock mode uses `listMockCommunitySummaries()`.
- Supabase mode uses `listSupabaseCommunitySummaries(client)` and relies on communities RLS.

## Manual test steps

1. Run `npm run typecheck`.
2. Run `npm run build`.
3. In mock mode, call `communityService.listCommunities()` and confirm five mock summaries are returned.
4. In Supabase mode, call `communityService.listCommunities()` while signed in and confirm RLS limits the returned rows.