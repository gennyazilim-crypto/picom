# Task 406 checkpoint: Hosted Supabase staging execution

## Status

**PARTIAL / Not ready.**

## Passed

- Dedicated hosted project and region inventory recorded.
- Migration apply and parity through `20260710258000`.
- Hosted Auth create/profile-trigger/login/session-restore/invalid-password/logout proof.
- Anonymous/owner/admin/moderator/member/visitor public/private RLS matrix.
- Private message attachment and Storage object access boundary.
- No secret was printed or committed.

## Failed or blocked

- Private Realtime Presence join returned `Unauthorized`; two-client realtime evidence is incomplete.
- Edge Functions were not deployed/validated.
- Full Mention/Profile/DM/lost-access and signed-URL refresh matrices remain open.

## Release impact

RB-01, RB-02, and RB-03 remain open. Stable release remains **No-Go**.