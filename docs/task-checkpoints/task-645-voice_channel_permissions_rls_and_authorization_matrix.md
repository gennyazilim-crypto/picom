# Task 645 Checkpoint: Voice Channel Permissions RLS and Authorization Matrix

## Result

**LOCAL CONTRACT PASS / HOSTED MATRIX BLOCKED**

## Changes

- Added canonical V1 Voice permissions and migrated existing grants/overrides.
- Kept `channels(type='voice')` as the only normal Voice Room model.
- Prevented public-read/visitor Voice metadata disclosure.
- Added authenticated, privacy-bounded Voice discovery RPC.
- Aligned token authorization with canonical discovery/join/audio/screen permissions.
- Limited normal V1 Voice to Text communities.
- Updated moderation to use multi-role hierarchy and active actor state.
- Added frontend permission types/catalog compatibility.
- Added hosted role/private/hierarchy validation harness.

## Provider/dashboard work

None. Task 643/644 hosted prerequisites remain blocked.

## Evidence

- `supabase/migrations/20260712164500_v1_voice_permission_matrix.sql`
- `scripts/smoke-voice-screen-permissions.mjs`
- `scripts/v1-voice-permissions-hosted-validation.mjs`
- `docs/v1-voice-permission-matrix.md`

## Remaining blockers

- Apply migration to approved staging.
- Provision synthetic owner/admin/moderator/member/visitor/banned/custom-role fixtures.
- Run hosted matrix.
- Prove membership removal/ban transition and immediate provider eviction.
- Complete Tasks 646-653.
- Task 654 remains forbidden while hosted evidence is blocked.
