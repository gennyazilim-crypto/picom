# Task Checkpoint: Full Profile Page MVP

## Scope

Implemented the Full Profile Page MVP after the Mention Feed MVP.

This task intentionally did not implement:

- LiveKit
- Supabase profile persistence
- Direct Messages
- Public discovery
- Mobile UI

## Implemented

- Added a full desktop `ProfileView`.
- Clicking user avatars/names now opens the full profile view instead of stopping at a popover-only flow.
- Profile view includes:
  - left profile card
  - avatar
  - display name
  - username
  - role badge
  - bio/status/details
  - follow/unfollow local state
  - profile stats
  - skills/tags
  - recent activity
  - shared media
- Recent activity can open the related community/channel.
- Shared media uses the existing AttachmentGrid and ImagePreviewModal.
- Follow state is local and also feeds the Mention Feed following filter.

## Validation

Run:

```bash
npm run typecheck
npm run mock:smoke
npm run build
```

Manual UI smoke:

```bash
npm run dev
```

Then verify:

- Login with the local seed account.
- Click a member avatar/name from MessageList, MemberSidebar, or Mention Feed.
- Confirm the full ProfileView opens.
- Toggle Follow/Following for a non-current user.
- Open a recent activity and confirm the app returns to the community chat layout.
- Open shared media and confirm ImagePreviewModal appears.
- Confirm ServerRail and custom titlebar remain stable.

## Notes

- Profile persistence remains local/mock-only.
- UserProfilePopover remains in the codebase as an MVP overlay foundation, but primary avatar/name clicks now route to the full profile view.
