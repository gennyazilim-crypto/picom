# Entity store normalization

Picom still keeps the live MVP state in the existing nested `Community[]` structure. A large migration to a fully normalized store would be risky right now because chat, mention feed, profile view, community menu, Supabase loaders, and local mock flows all read that nested shape.

Task 411 introduces the smallest safe slice: a typed normalized snapshot helper that can be used by future selectors and store migrations without changing current UI behavior.

## Added foundation

Source:

- `src/state/entityStore.ts`

The helper exposes:

- `createNormalizedEntityStore(communities)`
- `selectCommunity(store, communityId)`
- `selectChannelsForCommunity(store, communityId)`
- `selectMessagesForChannel(store, channelId)`
- `selectMembersForCommunity(store, communityId)`
- `selectRolesForCommunity(store, communityId)`

## Normalized indexes

The normalized snapshot contains:

- `communitiesById`
- `categoriesById`
- `channelsById`
- `messagesById`
- `membersById`
- `rolesById`
- `categoryIdsByCommunityId`
- `channelIdsByCommunityId`
- `channelIdsByCategoryId`
- `messageIdsByChannelId`
- `memberIdsByCommunityId`
- `memberIdsByUserId`
- `roleIdsByCommunityId`

## Ordering guarantees

- Categories and channels use `position` when available.
- Messages use per-channel `sequence` when available.
- Messages fall back to `createdAt` and then `id`.

This matches current message ordering expectations and keeps future pagination/realtime reconciliation compatible.

## Current decision

Do not replace `useLocalMessageState()` yet.

Reason:

- the MVP UI is currently stable
- nested community state is still the source of truth for many components
- a full migration would touch unrelated app surfaces
- this phase is production hardening, not a UI/state rewrite

## Future migration plan

1. Create memoized selectors from the normalized snapshot.
2. Move high-read paths first: active community, active channel, channel messages, and member list.
3. Keep write helpers compatible with existing mock and Supabase service results.
4. Add focused regression tests for channel switching, message send, member search, mention feed, profile view, and community menu.
5. Only then consider replacing nested state with a normalized reducer/store.

## Manual QA checklist

- Confirm community switching still works.
- Confirm channel switching still works.
- Confirm local message sending still works.
- Confirm member search still works.
- Confirm Mention Feed and Profile View still open.
- Confirm no horizontal overflow or layout shift appears.
