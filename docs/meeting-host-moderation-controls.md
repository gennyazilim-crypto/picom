# Meeting Host, Cohost, and Moderator Controls

## Authority model

- Hosts can lock/unlock, end for everyone, cancel a scheduled room, assign/remove cohosts, transfer host, manage lower participant roles, and change lower-role screen-share policy.
- Cohosts can lock/unlock and moderate lower roles, but cannot end the room, assign cohosts, transfer host, or control an equal/higher role.
- Community/meeting hierarchy is enforced by security-definer RPCs. Frontend capability checks are UX only.
- Every privileged mutation writes a meeting event and/or `audit_log` entry with actor, target, action, reason, room/session, and timestamp.

## Mute all

Mute-all is allowed only for hosts/cohosts with participant-management capability. It invokes the existing server-authorized mute action once per lower-ranked active microphone, so hierarchy and auditing are preserved for every target. Picom does not expose remote unmute because LiveKit and browser consent require each participant to unmute themselves.

## Host continuity

Explicit transfer promotes the selected active participant to host and demotes the previous host to cohost. If a live host disconnects, the earliest active cohost is promoted automatically. If no eligible cohost remains, the room/session end and remaining participant rows are closed. This prevents a permanently unmanaged live meeting.

## Screen share and Realtime

Participant screen-share policy is persisted separately from current track state. Disabling stops an active share through the authenticated LiveKit moderation function and blocks future screen-share token grants. Room, session, host, cohost, lock, and end changes are subscribed through Supabase Realtime and remote end/cancel transitions close the local meeting transport.

