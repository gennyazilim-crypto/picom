# Community Meeting Room Administration

Community Admin > Channels now owns Voice Lounge, Meeting, and Stage room configuration for Text, Radio, and Podcast communities. It extends the existing structure panel rather than creating a separate admin system.

## Configuration

Admins with `createMeeting`/`manageMeeting` configure room name, description, mode, microphone, camera, screen share, linked chat, reactions, raise hand, waiting room, audience mode, guest policy, participant limit and moderation policy.

Every room is backed by a normal Picom voice channel plus `meeting_rooms` metadata. Workspace resolution is deterministic:

- `voice` -> `voice_lounge`;
- `meeting` -> camera/grid meeting;
- `stage` -> stage/audience workspace.

Task 543 consumes this destination contract when the dedicated workspace shell is mounted. Existing community/channel navigation remains unchanged until that shell route is activated.

## Safety and audit

- Create requires both meeting and channel authority.
- Structural configuration is locked while a session is preparing/live/reconnecting.
- Archive requires the exact room title.
- Active sessions require an explicit `end` or `transfer` policy; the default is deny.
- Archive retains room/session/event/attendance and audit metadata.
- Room create/update/order/archive mutations pass through an audit trigger.
- Direct frontend Supabase calls are not used; UI calls `meetingRoomAdminService`.

Mock mode uses the same typed draft/result contract. Hosted Supabase RLS and real navigation/media execution remain separate validation gates.
