# Create community flow

Task 145 connects the MVP create-community flow.

## Entry point

- ServerRail add-community button opens `CreateCommunityModal`.

## Flow

1. User enters a community name and optional description.
2. Modal validates that the name is present.
3. Submit calls `communityService.createCommunity()`.
4. Mock mode returns a local summary without requiring Supabase.
5. Supabase mode inserts into `public.communities` through RLS.
6. The returned summary is converted into a lightweight UI community placeholder.
7. The new community appears immediately and becomes active.

## Files

- `src/components/CreateCommunityModal.tsx`
- `src/utils/communityFactory.ts`
- `src/state/useLocalMessageState.ts`
- `src/components/ServerRail.tsx`
- `src/App.tsx`

## Manual test steps

1. Run the app in mock mode.
2. Click the plus button in ServerRail.
3. Submit an empty name and confirm validation appears.
4. Submit a valid name.
5. Confirm the community appears immediately in ServerRail.
6. Confirm the new community becomes active and has a `general` text channel.
7. In Supabase mode, sign in before creating and confirm RLS handles insert permissions.