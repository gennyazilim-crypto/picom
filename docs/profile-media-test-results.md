# Profile Media Test Results

## Automated contract

The profile:edit-storage:smoke contract validates private Storage policy, canonical paths, atomic RPCs, signed URL/version behavior, stale-event rejection, one Realtime channel, worker processing, magic-byte checks, real progress, rollback, deduplication, shared components, crop controls, drop/paste, and notification cache versioning.

The task validation sequence is:

- npm run profile:edit-storage:smoke
- npm run typecheck
- npm run mock:smoke
- npm run build
- npm run qa:smoke

## Required hosted acceptance

Production completion is not asserted by repository tests alone. Two real authenticated Supabase users must be tested in separate desktop sessions:

1. User A changes avatar and cover.
2. User B sees both updates without restart in profile, feed, DM, community member list, message author, voice participant, and incoming-call notification.
3. A stale second window cannot overwrite the newer version.
4. Removing media falls back everywhere without a broken image.
5. A blocked/private viewer cannot obtain a signed object URL.

This hosted two-user acceptance remains a release gate until recorded with environment and timestamp.
