# Voice and screen permissions

Picom treats normal voice rooms as a separate capability from Radio broadcasting and Podcast publishing.

## Permission contract

| Permission | Purpose |
| --- | --- |
| `joinVoice` | Join an accessible configured voice channel. |
| `speak` | Publish microphone audio. |
| `shareScreen` | Publish an approved screen-share track. |
| `muteMembers` | Server-mute a lower-ranked participant. |
| `removeFromVoice` | Remove a lower-ranked participant. |
| `manageVoiceRoom` | Administrative superset for room moderation. |

`speakInVoice` remains a compatibility alias for existing grants. Radio host/listener permissions never imply normal voice permission.

## Type and enforcement contract

`type_settings.voiceRoomsEnabled` defaults to `true` for Text and `false` for Radio/Podcast. The database checks this setting, active membership, bans, timeouts, channel visibility, private access, and scoped grants before issuing LiveKit capabilities. The renderer mirrors returned microphone/screen grants but is not the security boundary.

Mute/remove requires action-specific permission or `manageVoiceRoom` and strict actor-above-target hierarchy. Successful provider actions are appended to immutable `audit_log`. LiveKit secrets remain inside Edge Functions.

Deploy the migration and both LiveKit Edge Functions, then validate all role/kind/private/ban/timeout cases in hosted staging. Hosted success is not claimed without those credentials.
