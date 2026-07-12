# Meeting history and attendance

## Source of truth

Picom history is a projection of durable meeting rooms/sessions and the verified LiveKit webhook lifecycle introduced in Task 536. `room_started`, `participant_joined`, `participant_left`, connection-aborted, and `room_finished` events remain authoritative. Renderer presence is never treated as final attendance evidence.

The `meeting_history_verified_outcome` trigger projects a verified `room_finished` event into safe session fields:

- `duration_seconds`
- `outcome_code=provider_ended`
- `outcome_source=verified_livekit_webhook`
- `outcome_verified_at`

Existing verified events are backfilled. Failed or backend-ended sessions may remain unverified until their authorized backend lifecycle supplies a safe outcome. The UI labels only webhook-backed outcomes as verified.

## Access model

`get_meeting_history` requires authentication and supports two scopes:

- `community`: current community members see visible upcoming/live/ended session summaries.
- `mine`: a current member, or a former participant with retained attendance, sees only sessions containing their own attendance row.

Session summaries do not expose provider room names, provider identities/hashes, private payloads, tokens, email, raw media, or transcript text.

`get_meeting_attendance_history` returns:

- all safe attendance rows only when the current user has `viewMeetingHistory` in the session community;
- otherwise only the current user's own row;
- no provider identity hash, even for managers;
- generic `Guest participant` identity for attendance that cannot safely map to a Picom profile.

Direct table RLS remains the defense in depth boundary: attendance is selectable only by its user or a `viewMeetingHistory` role.

## Product surfaces

- Community Admin > Events shows recent/upcoming sessions and complete attendance only for allowed managers.
- Meeting Info shows the current user's recent participation; non-managers receive only their own attendance.
- Upcoming/live sessions use the existing meeting deep-link parser.
- Ended sessions open only through the existing durable meeting-chat context service, which performs its own channel/RLS access check.
- When linked chat is unavailable or inaccessible, Picom gives a truthful unavailable result rather than routing to private content.

Profile activity integration remains intentionally optional. It must not be added until `get_profile_domain_v1` applies the same shared-community/channel privacy boundary to meeting history.

## Explicit exclusions

- No recording exists or is implied.
- No raw audio, camera, or screen media is retained.
- Task 567 captions are ephemeral; history can state that captions were used but always reports `transcriptRetained=false`.
- No transcript replay, export, summary, or automatic notes are available.

## Hosted validation

Local smoke verifies schema/RPC/UI contracts. Real RLS role tests and webhook reconciliation require a protected Supabase staging project and signed LiveKit webhook evidence. Until available, that evidence is **BLOCKED**, not PASS.
