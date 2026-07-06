# Task next-04 checkpoint: Role-Aware Community Menu

## Status

Complete and verified against `picom_next_10_full_mvp_tasks_txt.zip` task 04.

## Implementation status

The role-aware community access foundation already exists:

- `src/types/communityAccess.ts`
- `src/services/permissions/communityPermissions.ts`
- `src/services/community/communityMembershipService.ts`
- `src/services/community/communityMenuService.ts`
- `src/components/CommunityHeader.tsx`
- `src/components/CommunityMenu.tsx`
- `src/components/CommunitySidebar.tsx`
- `supabase/migrations/20260704002600_community_public_access_rls.sql`

## Verified behavior

- Owner, admin, moderator, member, and visitor access states are modeled.
- Header action routes owner/admin to admin center, moderator to moderator panel, member to member panel, and visitor to visitor panel.
- Visitor public read mode hides private channels through access filtering.
- Visitor composer/reaction/send paths are blocked by `canSendMessage` checks.
- Join and leave flows exist in mock/service layer.
- Owner leave is blocked until transfer placeholder.

## Validation

- `npm run community:access:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Notes

Build passes with the existing Vite chunk-size warning. No mobile UI, Discord assets/colors, unrelated layout redesign, or Electron titlebar changes were added.
