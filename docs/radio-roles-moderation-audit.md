# Radio Roles, Moderation, and Audit

## Common roles

- `Owner` and `Admin` remain the highest Radio authorities.
- `Radio Producer` is level 70 and may manage schedules, programs, production assignments, and listener moderation.
- `Radio Host` is level 50 and may create a broadcast as its primary host or manage a session to which it is assigned.
- `Member` may listen but cannot manage production.

Session assignments do not replace common roles. A listener must first hold a common role with `hostRadio` or the appropriate producer capability before a session assignment can grant access.

## Hierarchy

- Owners may assign any eligible common-role member.
- Admins may assign only roles and members below their own level.
- Producers may assign Host or Co-host, but cannot grant Producer to themselves or peers.
- Radio Hosts cannot manage production assignments.
- The primary session host cannot be removed or changed through the assignment UI. A future explicit transfer flow is required.
- Removing a common Radio role immediately removes the role-backed session management path.

## Listener moderation

Mute, unmute, and remove are separate from a listener's own volume/mute controls. Server functions reject self-moderation, owner moderation, and equal-or-higher role targets. Reports enter the existing protected moderation queue.

## Audit

Create/start/end/cancel, schedule changes, host assignment/removal, and listener moderation append immutable community audit facts. `list_radio_session_audit` exposes only one session's Radio audit facts to an authorized current session manager.

## Validation

Run:

```powershell
npm run radio:roles-moderation-audit:smoke
npm run radio:host-producer:smoke
npm run radio:service-realtime:smoke
npm run typecheck
npm run mock:smoke
npm run supabase:smoke
npm run build
npm run qa:smoke
```

Hosted RLS execution requires a configured Supabase CLI/project and separate owner, producer, host, member, and unauthorized test identities. Structural checks do not claim hosted evidence.
