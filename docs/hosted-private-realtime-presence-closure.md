# Hosted Private Realtime Presence Closure

Status date: 2026-07-11  
Result: **BLOCKED - hosted execution unavailable in this operator session**

## Canonical topic contract

| Capability | Topic |
| --- | --- |
| Community presence | `presence:community:<communityId>` |
| Channel typing | `typing:community:<communityId>:channel:<channelId>` |
| Channel room/broadcast | `room:community:<communityId>:channel:<channelId>` |

The renderer, hosted validator, and committed Realtime authorization migrations use the same formats.

## Client safety review

- Community Presence channels use `config.private: true`.
- Presence keys use the authenticated profile/user UUID.
- Tracking begins only after `SUBSCRIBED`.
- Presence updates are throttled and offline state calls `untrack()`.
- Community/user changes remove the old channel and clear local state.
- Reconnect and focus recovery retrack the latest bounded presence payload.
- Diagnostics include safe status and community identifiers only; no token/session object is logged.

## Authorization review

Committed migrations grant only `select` and `insert` on `realtime.messages` to `authenticated`. RLS delegates topic access to the immutable JWT subject and requires:

- community membership for `presence:community:*`,
- matching community/channel UUIDs for channel topics,
- permitted private-channel role/access for private room topics.

No policy was broadened to all authenticated users during this task.

## Local evidence

| Check | Result |
| --- | --- |
| Hosted runner preflight | PASS; names required variables and performs no network request |
| Realtime staging contract | PASS |
| Supabase schema smoke | PASS |
| Typecheck | PASS |
| Production build | PASS |
| QA smoke | PASS |

## Hosted blocker

The required authorized/unauthorized staging matrix could not be rerun because this operator session has:

- no Supabase CLI on `PATH` or available project-local CLI,
- no `supabase/.temp/project-ref` linkage,
- none of the protected `PICOM_REALTIME_*` staging variables,
- no connected browser automation interface to the user's existing Supabase dashboard session.

The previous real staging run returned `Unauthorized` for authenticated private Presence. That result is not superseded. Required closure evidence remains:

1. owner/member subscribe and track PASS,
2. two authorized clients see each other,
3. visitor and unauthorized private-channel member are denied,
4. owner/admin/moderator behavior matches role policy,
5. token refresh/reconnect leaves no ghost Presence,
6. redacted logs contain no JWT or secret.

## Release impact

Task 419 remains **BLOCKED**. RB-03 remains open and Task 406 cannot be moved to PASS from this evidence.

