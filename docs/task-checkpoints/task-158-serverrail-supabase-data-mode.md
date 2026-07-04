# Task 158 Checkpoint: Connect ServerRail to Supabase data mode

## Completed

- Added local state replacement support for loaded communities.
- Loaded Supabase communities after auth session initialization.
- Routed loaded community summaries through `createCommunityFromSummary()`.
- Kept mock mode unchanged.
- Documented env variables and RLS implications.

## Changed files

- `src/App.tsx`
- `src/state/useLocalMessageState.ts`
- `docs/serverrail-supabase-data-mode.md`
- `docs/task-checkpoints/task-158-serverrail-supabase-data-mode.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual test: set `VITE_DATA_SOURCE=supabase`, sign in, and confirm ServerRail loads Supabase communities visible to the authenticated user.