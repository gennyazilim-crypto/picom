# Task 157 Checkpoint: Create members service

## Completed

- Added typed `membersService`.
- Added `MemberSummary` DTO.
- Added mock-mode member listing.
- Added Supabase-mode `community_members` listing.
- Documented deferred profile/role expansion.

## Changed files

- `src/services/membersService.ts`
- `docs/members-service.md`
- `docs/task-checkpoints/task-157-members-service.md`

## Verification

Run:

```bash
npm run typecheck
npm run build
```

Manual verification can be added later by routing `MemberSidebar` data loading through `membersService.listMembers()`.