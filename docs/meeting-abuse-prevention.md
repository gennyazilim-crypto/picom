# Meeting Abuse Prevention

## Server boundaries

Picom applies independent server budgets to meeting token issuance, invite creation/validation, join previews, waiting requests, hand/stage signals, meeting chat, reactions, and privileged controls. General message/report limits remain active as an additional layer.

| Action | Full MVP budget |
| --- | --- |
| LiveKit token | 10 per 60 seconds |
| Invite/join preview | 30 per 60 seconds |
| Invite writes | 30 per 5 minutes |
| Waiting requests | 6 per 5 minutes |
| Hand/stage signal | 12 per 60 seconds |
| Meeting chat send | 20 per 30 seconds, plus normal message limit |
| Reaction | 8 per 3 seconds, plus renderer burst protection |
| Privileged meeting action | 30 per 60 seconds |
| Safety reports | 5 per 10 minutes and 25 per day |

Limits are per authenticated user. They are intentionally high enough for ordinary use while bounding automated bursts. A rejected request receives a generic retry message; responses do not reveal whether a private room, account, invite target, or blocked relationship exists.

## Reaction transport

Production reactions use the `send_meeting_reaction` RPC and an RLS-filtered, short-lived Realtime table. Clients cannot insert/update/delete reaction rows. The RPC derives the sender from `auth.uid()`, checks active participation, capability, bans/timeouts, kind schema, event idempotency, and rate budget. The meeting token no longer grants LiveKit data publication, preventing direct clients from bypassing the reaction RPC.

Mock reactions remain local and deterministic. No custom reaction text or arbitrary JSON reaches the production signal table.

## Payload validation

- Token and join Edge Functions enforce JSON content type, allowlisted keys, UUID/hash formats, origin policy, and 2 KiB/1 KiB body limits.
- Waiting messages are capped at 280 characters and 1120 UTF-8 bytes with idempotency-key validation.
- Meeting chat inherits the 4,000-character message contract, four-attachment limit, attachment ownership/scan checks, reply visibility checks, and client-message idempotency.
- Hand/stage and privileged controls accept allowlisted actions and permission-checked targets.
- Invite secrets are never persisted; SHA-256 hashes, limited use counts, expiry, unique redemption, revocation, intended-user, ban, and blocking checks prevent replay/brute-force disclosure.

## Abuse evidence

Rate-limit denial emits only the server marker `PICOM_MEETING_ABUSE rate_limit_exceeded action=<allowlisted-action>`. It deliberately omits user ids, room ids, invite values, request/message text, media, provider identities, headers, and credentials. Aggregate counters remain app-admin restricted.

## Reports and moderator review

Participant context menus submit `user` reports through the shared `ReportModal`; meeting chat submits `message` reports through `meetingChatContextService`. Both use `reportService`, the protected `submit_safety_report` RPC, the community moderation queue, explicit review transitions, and audit logging. No meeting-specific unreviewed shadow queue is introduced.

## Hosted validation blocker

Structural tests cover functions, triggers, RLS privileges, token grants, and service wiring. Real burst timing, concurrent counters, Realtime delivery, and moderator queue evidence require a configured hosted Supabase/LiveKit staging environment and remain BLOCKED until that run is performed.
