# Picom V1 Voice Permission Matrix

Status date: 2026-07-12
Decision: **INCLUDED**

## Ordinary media access

| Actor state | Discover/join | Microphone | Screen Share | Subscribe |
| --- | --- | --- | --- | --- |
| Owner, active member | Allow | Allow | Allow | Allow |
| Admin, active member | Allow | Allow | Allow | Allow |
| Moderator, active member | Allow | Allow | Allow | Allow |
| Member, active | Allow | Allow | Allow | Allow |
| Roleless member, active | Allow | Allow | Allow | Allow |
| Visitor/non-member | Deny | Deny | Deny | Deny |
| Removed/banned/suspended | Deny | Deny | Deny | Deny |
| Unauthenticated | Deny | Deny | Deny | Deny |

Owner/Admin/Moderator/custom roles do not change ordinary Voice or Screen access. Public-read status never grants media access.

## Moderation

Mute, remove, ban, and end-room authorization is separate. A normal member cannot moderate another participant. Moderator/Admin/Owner actions follow the canonical hierarchy and audit boundary.

## Server enforcement

The authorize_livekit_room and list_visible_voice_rooms database paths enforce authenticated active membership and safety state. The livekit-token Edge Function issues short-lived, intent-scoped grants. Renderer checks are UX only.

## Evidence

Protected runs 29197503222, 29198913461, and 29199409039 passed the active/denied actor matrix, four-client media, packaged Windows, rate-limit, reconnect, and cleanup gates.
