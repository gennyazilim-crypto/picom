# Meeting participant state reconciliation

## Authority contract

| Concern | Authoritative source | Renderer behavior |
| --- | --- | --- |
| Authenticated identity | Supabase Auth and `profiles` | Never inferred from LiveKit display metadata. |
| Meeting role/capabilities | Meeting RPCs and RLS | Read-only in participant snapshots. |
| Community role | `community_members` and `roles` | Displayed separately from the meeting role. |
| Verification | Approved `profile_verifications` rows | Pending, rejected, and revoked records are not projected. |
| Participant join/leave | Verified LiveKit webhook reconciliation | Ordered by provider event time and deduplicated by receipt ID. |
| Attendance | `meeting_attendance` | Historical; never inferred from speaking or track state. |
| Hand state | `set_meeting_participant_hand_state` RPC | Server-versioned and Realtime synchronized. |
| Speaking, quality, live tracks | Current LiveKit room | Ephemeral overlay; it cannot change identity, roles, or verification. |
| General client presence | Privacy-filtered `friend_presence` | Kept separate from provider room presence. |

## Reconnect and duplicate-device policy

Meeting tokens use the canonical profile UUID as the provider identity. A user therefore owns one participant row per session. A reconnect reuses that row and increments `connection_generation` after a completed connection. The client store also deduplicates defensively by user ID, preferring the active and newest generation.

Webhook receipts provide event-ID idempotency. Participant and track rows additionally retain provider event timestamps. Older events are acknowledged as stale without reverting newer state. Equal-time terminal participant/track events win over non-terminal events.

## Ghost cleanup

`cleanup_stale_meeting_participants` is restricted to the service role or an authorized meeting manager and refuses unsafe cleanup windows. It closes stale participant, track, hand, and attendance state, recalculates the session count, and appends a bounded meeting event. Normal clients cannot mutate provider-authoritative participant lifecycle rows directly.

## Privacy

`get_meeting_participant_snapshot` requires sensitive meeting visibility. It returns only safe profile fields, approved verification, a privacy-filtered presence status, role summaries, media metadata, and attendance for that session. It excludes email, auth tokens, private profile details, raw provider payloads, and unrelated presence history.

## Operations

- Schedule cleanup only from a trusted backend worker or invoke it manually as an authorized meeting manager.
- Alert on repeated stale cleanup counts, webhook receipt failures, and participant-count drift.
- Hosted verification requires applying migrations and running `supabase/tests/meeting_participant_reconciliation.sql`; local structural checks do not replace hosted RLS evidence.
