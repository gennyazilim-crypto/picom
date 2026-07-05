# Polls Feature Foundation

Status: post-MVP foundation

Polls are planned as a future message-adjacent feature for Picom channels. This foundation captures the data model, permissions, realtime behavior, and UI direction without enabling poll creation in the current MVP runtime.

## MVP stance

- Poll creation, voting, and poll rendering are not enabled in the current MVP runtime.
- Existing message sending, replies, reactions, attachments, and realtime message flow remain unchanged.
- Polls should be enabled only when Supabase schema, RLS, and realtime reconciliation are ready.

## Future data model placeholder

Potential tables:

### `polls`

- `id`
- `message_id`
- `community_id`
- `channel_id`
- `question`
- `allow_multiple`
- `closes_at`
- `created_by_id`
- `created_at`
- `deleted_at`

### `poll_options`

- `id`
- `poll_id`
- `text`
- `position`

### `poll_votes`

- `id`
- `poll_id`
- `option_id`
- `user_id`
- `created_at`

Constraints should prevent duplicate votes for single-choice polls and keep option order stable.

## Future Supabase/RLS rules

- Users can view polls only if they can view the channel.
- Users can vote only if they are authenticated members with channel access.
- Users can create polls only if they can send messages in the channel.
- Users can edit/delete only their own poll if allowed, or moderators/admins with message moderation permissions.
- Private channel polls must not appear in search or notification surfaces for unauthorized users.

## Future service methods

Potential typed methods:

- `createPoll(channelId, payload)`
- `voteOnPoll(pollId, optionId)`
- `removePollVote(pollId, optionId)`
- `fetchPollResults(pollId)`

Poll writes should use idempotency keys where possible to avoid duplicate poll creation after retries.

## Future UI placeholder

Future desktop UI surfaces:

- MessageComposer plus menu > Create Poll
- Slash command `/poll` when slash commands are enabled
- Poll card inside MessageList
- Compact vote bars and counts
- Closed poll state
- Deleted poll fallback

No mobile bottom sheet or web-first layout should be introduced.

## Realtime behavior

Future realtime events should reconcile safely:

- `poll:created`
- `poll:updated`
- `poll:deleted`
- `poll:vote_added`
- `poll:vote_removed`

Clients should deduplicate events by `eventId` and avoid overwriting newer local state with older vote snapshots.

## Validation rules

- Poll question is required.
- At least two options are required.
- Option text must be bounded and non-empty.
- Maximum option count should be configured.
- Closing time must be in the future if provided.
- Message content analytics must not collect poll question or option text.

## Feature flag behavior

A future `enablePolls` flag should hide poll entry points when disabled. Backend permission and RLS rules remain mandatory even if frontend flags hide UI.

## Implementation decision

This task is documentation-first. Runtime poll UI, Supabase migrations, and message rendering changes are intentionally deferred to avoid destabilizing the current MVP chat flow.

## Manual verification

- Confirm existing message sending still works.
- Confirm no poll creation button appears in the MVP composer.
- Confirm this document is used before future poll schema/runtime work begins.
