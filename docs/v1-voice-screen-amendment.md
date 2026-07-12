# V1 Voice and Screen Share Amendment

Status date: 2026-07-12  
Amendment tasks: 657-668

## Decision

Tasks 657-668 supersede the role-restricted access and inclusion sequence in Tasks 645-654. Historical checkpoints remain immutable evidence, but their role/channel/custom-role requirements are not the current product policy.

The replacement rule is documented in `docs/v1-community-member-media-policy.md`: every authenticated active community member may discover Voice channels, join, publish microphone audio, subscribe to remote audio, share a selected screen, and receive remote Screen Share tracks.

## Focused conflict audit

| Area | Current conflict | Required owner task |
| --- | --- | --- |
| Renderer entry gate | `src/App.tsx` checks `joinVoiceRoom`/legacy role permissions before join. | Task 660 |
| Renderer media controls | `src/App.tsx` combines provider grants with role permission arrays for `publishAudio` and `shareScreen`. | Task 660 |
| Voice discovery/RLS | `20260712164500_v1_voice_permission_matrix.sql` requires effective role permissions and private-channel grants for ordinary Voice discovery. | Task 660 |
| Token authorization | `authorize_livekit_room` derives join/audio/screen from effective role/channel permissions. | Tasks 660-661 |
| Legacy authorization | `20260711150100_livekit_token_authorization.sql` and `20260711150600_voice_screen_permissions_moderation.sql` retain per-role/per-channel access decisions. | Task 660 migration supersession |
| Meeting policy | Meeting migrations grant Share Screen differently by role. Meeting moderation/workspace behavior is separate; ordinary community Voice must not inherit this restriction. | Task 660 boundary test |
| Scope language | `docs/v1-voice-screen-scope-lock.md` describes role-aware ordinary join/speak enforcement. | This amendment and Task 668 |
| Hosted fixtures | Task 645 tests owner/admin/moderator/member permission differences for ordinary media. | Tasks 660 and 665 |
| Release visibility | `v1ReleaseScope.ts` and `release-manifest.json` remain `HIDDEN_FROM_V1`. | Task 668 only after evidence |

## Preserved controls

The amendment does not remove authentication, active-membership validation, ban/suspension/removal checks, canonical room identity, method/body/CORS validation, token TTL, provider capacity, rate limits, abuse controls, safe track cleanup, emergency disable controls, or role/hierarchy-based moderation.

## Supersession map

- Task 645: its migration and checkpoint are historical; ordinary role/override restrictions are replaced in Task 660. Moderation hierarchy work remains reusable.
- Tasks 646-654: paused and superseded by Tasks 657-668; uncommitted Task 646 work is not authoritative.
- Tasks 655-656: may resume only if Task 668 records `INCLUDED`; otherwise public release is forbidden.

## Evidence sequence

1. Task 658 provisions real staging and production LiveKit projects.
2. Task 659 links protected Supabase/GitHub hosted staging.
3. Tasks 660-664 implement and expose the canonical active-member behavior while keeping the V1 release gate hidden.
4. Task 665 proves hosted two-client audio and multi-share behavior with active-member/visitor/blocked fixtures.
5. Task 666 proves the exact packaged Windows artifact.
6. Task 667 closes security, abuse, reconnect, and cleanup gates.
7. Task 668 decides `INCLUDED` or `BLOCKED` from immutable evidence.

No local smoke, mock result, source review, or dev-window screenshot substitutes for hosted or native evidence.

