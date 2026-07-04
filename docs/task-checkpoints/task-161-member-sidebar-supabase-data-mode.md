# Task 161 Checkpoint: Connect MemberSidebar to Supabase data mode

## Completed

- Enriched `membersService` with visible profile data.
- Added local state replacement for community members.
- Loaded Supabase members for the active community.
- Kept mock mode unchanged.
- Documented RLS and environment requirements.

## Changed files

- `src/App.tsx`
- `src/services/membersService.ts`
- `src/state/useLocalMessageState.ts`
- `docs/member-sidebar-supabase-data-mode.md`
- `docs/task-checkpoints/task-161-member-sidebar-supabase-data-mode.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual test: in Supabase mode, sign in and confirm MemberSidebar is populated from Supabase-visible community members.