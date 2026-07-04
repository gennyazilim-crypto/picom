# Community service

Task 143 adds the frontend community data service boundary.

## File

```text
src/services/communityService.ts
```

## Responsibilities

- List communities for the active data source.
- Create a community in the active data source.
- Preserve mock mode without requiring Supabase.
- Use Supabase Auth and RLS in Supabase mode.
- Return safe DTOs instead of database rows or UI-heavy nested community objects.

## DTO

`CommunitySummary` includes:

- `id`
- `ownerId`
- `name`
- `description`
- `iconUrl`
- `accentColor`
- `createdAt`
- `updatedAt`

It intentionally does not include members, channels, messages, secrets, or auth/session data.

## Data source behavior

- `mock`: returns deterministic summaries from `mockCommunities`; `createCommunity()` returns a local placeholder summary.
- `supabase`: queries `public.communities` through the anon client and relies on RLS.

## Manual test steps

1. Set `VITE_DATA_SOURCE=mock` and call `communityService.listCommunities()`; it should return mock community summaries.
2. Call `communityService.createCommunity({ name: "Test" })`; it should return a mock summary.
3. Set `VITE_DATA_SOURCE=supabase` without Supabase env values; service should return `DATA_SOURCE_NOT_CONFIGURED`.
4. Set valid Supabase values and sign in; listing and creation should follow RLS.
5. Run `npm run typecheck` and `npm run build`.