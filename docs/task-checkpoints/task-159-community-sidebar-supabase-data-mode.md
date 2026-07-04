# Task 159 Checkpoint: Connect CommunitySidebar to Supabase data mode

## Completed

- Added `channelCategoryService` for category listing.
- Added local state replacement for community categories.
- Loaded Supabase categories/channels for the active community.
- Kept mock mode unchanged.
- Documented RLS and environment requirements.

## Changed files

- `src/App.tsx`
- `src/services/channelCategoryService.ts`
- `src/state/useLocalMessageState.ts`
- `docs/community-sidebar-supabase-data-mode.md`
- `docs/task-checkpoints/task-159-community-sidebar-supabase-data-mode.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual test: in Supabase mode, sign in and switch communities. The CommunitySidebar should show Supabase categories/channels for the active community.