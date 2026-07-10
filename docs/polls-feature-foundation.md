# Polls Production Model

Picom polls support creation, voting, closing, and realtime result refresh while preserving channel visibility and send permissions.

## Write model

- Poll creation and options are inserted by one atomic database RPC after verifying the caller authored the message and can send in its channel.
- Vote toggles are serialized per poll/user with a transaction advisory lock.
- Direct table writes are revoked; the RPC prevents duplicate and conflicting single-choice votes.
- Poll authors and community moderators may close a poll. Closed or expired polls reject votes.
- Poll state returns aggregate counts and the current user's selections without exposing voter identity lists.

## Visibility and realtime

Poll reads follow the underlying message and channel visibility policy. Voting additionally requires authenticated send permission, so public visitors cannot vote. Vote and close changes trigger a bounded poll snapshot refresh through Supabase Realtime; subscriptions are removed when the card unmounts.

## Validation

Questions are 1-240 characters, polls contain 2-10 unique options, and each option is at most 100 characters. Optional close time must be in the future.

## manual checklist

1. Create a poll in a writable text channel and confirm all options appear.
2. Attempt creation in a channel without send permission and confirm rejection.
3. Vote twice on the same choice and confirm the second click removes the vote.
4. Change a single-choice vote and confirm only one selection remains.
5. Open two desktop windows and confirm vote counts refresh.
6. Close as author/moderator and confirm further voting is disabled.
7. Verify a visitor/private-channel user cannot vote or read inaccessible poll data.
