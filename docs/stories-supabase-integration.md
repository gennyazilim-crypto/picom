# Following Stories Supabase integration

## Data sources

The production read model includes only followed authors and RLS-visible resources:

- **Status:** followed profile `status_text` only when `can_view_profile` passes.
- **Media:** followed-author visible messages with clean/development-skipped attached media and approved URL.
- **Mention highlight:** followed-author visible messages with normalized `message_mentions` rows.
- **Community update:** followed-author visible messages in announcement channels.
- **Event:** non-cancelled events created by followed users and visible under event/channel RLS.
- **Voice:** backend-produced `voice_story_events` visible only through followed relationship and `can_view_channel`.

No message/private channel is made visible merely because its author is followed.

## Security model

- `followed_user_stories_view` uses `security_invoker` and all source tables retain RLS.
- The view and cursor function are authenticated-only.
- Blocked relationships are excluded in the final projection.
- Normal clients receive SELECT only on `voice_story_events`; insertion/update/delete requires a trusted backend/service role path that is not implemented in the renderer.
- Voice rows contain no audio, transcript, speaking activity, participant list, device data or screen-share content.
- Media rows exclude pending/suspicious/failed attachments and never return raw storage paths.
- Story text is bounded from already visible fields; no private content copy is stored in a new story table.

## Service and UI behavior

- `storyService.listPage` provides cursor pagination and a mock fallback.
- Supabase App startup loads stories through the service; components remain backend-agnostic.
- Existing story viewer, previous/next, Open in channel and local seen state remain unchanged.
- Server rows start `unseen` on reload. Persistent seen state is intentionally deferred rather than introducing an unreviewed tracking table.
- The renderer keeps a second access check against its loaded community/channel model, but RLS is authoritative.

## Current limitations

- No backend currently writes `voice_story_events`; the table is a least-privilege sink for a future LiveKit/voice service.
- Mention stories depend on trusted mention extraction from Task 269.
- Status uses profile update time because a separate versioned status-event stream does not exist.
- Events with no visible/known community context remain subject to source RLS but may be filtered by current renderer state.
- Story media uses approved existing URLs; private signed delivery needs its dedicated storage integration.
- No auto-advance analytics or copyrighted external artwork was added. Existing Picom gradient artwork remains the fallback.

## Validation

Local:

- `npm run stories:supabase:smoke`
- `npm run stories:header:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

Hosted manual/RLS checks:

1. Followed author, shared public channel: source appears.
2. Same author, private/inaccessible channel: source never appears by list, direct view or cursor RPC.
3. Unfollow/block: rows disappear on the next query.
4. Suspicious/pending attachment: no media story/URL.
5. Cancelled event: no event story.
6. Voice event with mismatched community/channel: trusted producer rejects it; viewer cannot see it.
7. Anonymous and non-following authenticated users: no rows.

Supabase CLI/hosted migration execution is unavailable on this workstation, so these RLS checks remain required external evidence.
