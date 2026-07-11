# Meeting schedules, invitations, and join policy

Task 534 extends Picom's canonical meeting backend without storing raw media or invite secrets.

## Scheduling contract

- `schedule_meeting_room` requires `manageMeeting`, rejects active-session conflicts, and links or creates a `community_events` record.
- Start/end times, host, deduplicated cohosts, event linkage, and a JSON reminder policy persist on `meeting_rooms`.
- Hosts and cohosts must be valid, unrestricted community members (the community owner is also valid).
- The audit log records schedule changes without credentials or provider metadata.

## Invitation contract

- The renderer creates a cryptographically random secret and sends only its lowercase SHA-256 digest plus an eight-character hint to `create_meeting_invite`.
- The raw secret is returned once to the caller for sharing and is never persisted, selected from Supabase, logged, or included in audit metadata.
- Invitations target a room and optionally a session/user, expire within 30 days, may be revoked, and support 1-100 unique-user redemptions.
- `meeting_invite_redemptions` preserves reconnect authorization per user. A revoked or expired invite invalidates even an earlier redemption.
- Direct table access to invite hashes and redemption rows is revoked; sanitized management data comes from `list_meeting_invites`.

## Join decision

`meeting-join` is a JWT-verified, origin-restricted Edge Function. It accepts `preview`, `validate`, and `redeem`, hashes incoming secrets in memory, and invokes security-definer RPCs. Responses use `Cache-Control: no-store` and never echo secrets or hashes.

The database decision denies archived/unavailable rooms, bans, active timeouts, blocking relationships, revoked/expired/exhausted/wrong-user invites, and rooms that are not open. `invite_only` requires a valid grant even for normal members; `members` permits authorized community members; `open` additionally permits authenticated visitors when the public community/channel policy allows it. Waiting-room and approval policies return a truthful `waiting` disposition.

## Rate limits and evidence

- Schedule writes: 20 per five minutes per authenticated user.
- Invite writes: 30 per five minutes per authenticated user.
- Preview/validate/redeem: 60 per minute per authenticated user.
- `scripts/meeting-schedules-invites-join-policy-smoke.mjs` checks the static security contract.
- `supabase/tests/meeting_schedules_invites_join_policy.sql` checks applied-schema function/table privileges in a disposable database.

No real hosted Supabase migration or actor-matrix claim is made until a configured CLI/staging project executes the SQL test.
