# Picom V1 Voice Permission Matrix

Status date: 2026-07-12  
Local database contract: **PASS**  
Hosted RLS/token matrix: **BLOCKED**

## Canonical model

Picom keeps one Voice Room model: a `channels` row with `type='voice'`. No duplicate room or participant-history table was added.

Canonical V1 Voice permissions:

- `viewVoiceRoom`
- `joinVoiceRoom`
- `publishAudio`
- `shareScreen`
- `muteMembers`
- `removeFromVoice`
- `manageVoiceRoom`

Legacy `joinVoice`, `speak`, and `speakInVoice` grants remain as compatibility inputs. Migration `20260712164500_v1_voice_permission_matrix.sql` copies existing role and category/channel override intent into the canonical keys. New authorization uses only canonical keys.

Normal V1 Voice is limited to Text communities. Radio, Podcast and Meeting media permissions remain separate hidden/post-V1 paths.

## Built-in role defaults

| Role | Discover | Join | Publish audio | Share screen | Mute lower role | Remove lower role | Manage room |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Owner | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Moderator | Yes | Yes | Yes | Yes | Yes | Yes | No |
| Member | Yes | Yes | Yes | Yes | No | No | No |
| Visitor | No | No | No | No | No | No | No |
| Custom role | Explicit grants/overrides | Explicit | Explicit | Explicit | Explicit + hierarchy | Explicit + hierarchy | Explicit + hierarchy |

Owner invariants still validate community and channel scope before returning true.

## Channel and private overrides

- Category overrides apply before channel overrides.
- Any deny across a user's assigned roles wins over allow at the same scope.
- Private Voice channels additionally require `viewPrivateChannels`.
- A role-level allow cannot bypass a channel-level deny.
- Custom roles are evaluated through the existing multi-role permission engine.
- Public-read flags never grant Voice metadata or join access.

## Discovery and metadata privacy

`can_read_public_channel` now excludes `type='voice'`. Anonymous users and visitors cannot select Voice channel rows merely because a community is public.

`list_visible_voice_rooms`:

- is authenticated-only;
- requires active membership;
- denies bans and active timeouts;
- requires Text community, enabled Voice configuration and `viewVoiceRoom`;
- enforces private-channel permission;
- returns channel id/name/topic/private flag and caller capability booleans only;
- returns no participants, presence history, device data, provider room identifier or token.

The ordinary channels SELECT policy delegates to `can_view_channel`, so direct table queries and discovery RPC agree.

## Join and token agreement

`authorize_livekit_room` requires:

1. authenticated caller;
2. active Text community;
3. Voice enabled for the community;
4. active membership;
5. no active ban or timeout;
6. a Voice channel in the same community;
7. `viewVoiceRoom`;
8. `joinVoiceRoom`;
9. `viewPrivateChannels` for private rooms.

It returns:

- `can_publish_audio` from `publishAudio`;
- `can_publish_screen` from `shareScreen`.

The Task 644 token function maps those booleans to microphone/screen source grants and does not infer access from UI state.

## Moderation hierarchy

Mute/remove authorization:

- requires active actor membership;
- denies banned/timed-out actors;
- uses the maximum level across all assigned roles;
- never permits self-moderation;
- never permits equal/higher target moderation;
- requires `muteMembers`, `removeFromVoice`, or `manageVoiceRoom`;
- records executed provider moderation through the existing audit RPC.

## Membership, ban and token lifecycle

Membership removal, ban, timeout or permission override immediately blocks new discovery and token authorization. A previously issued participant token can remain valid until its ten-minute expiry; immediate eviction/revocation also requires the provider moderation/removal path. Hosted transition timing is part of Tasks 647/653 and is not claimed by this migration.

## Hosted validation

`npm run voice:permissions:hosted -- --run` is prepared for synthetic staging fixtures:

- owner/admin/moderator/member;
- visitor;
- banned user;
- unauthorized member/custom override;
- public and private Voice channels;
- Voice and Screen intents;
- direct channel metadata leak probes;
- multi-role moderation hierarchy.

Current result is **BLOCKED** because the protected `hosted-staging` environment, project, migration deployment and synthetic fixtures do not exist.

## Release decision

Local schema/RLS agreement is complete, but the acceptance criterion requiring real hosted evidence is not. Voice Rooms and Screen Share remain `HIDDEN_FROM_V1`.
