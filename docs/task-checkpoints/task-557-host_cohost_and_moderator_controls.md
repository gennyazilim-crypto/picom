# Task 557 Checkpoint - Host, Cohost, and Moderator Controls

Delivered server-authorized lock/unlock, waiting-room decisions, mute/remove, stage promote/demote, participant screen-share policy, cohost assignment/removal, explicit host transfer, mute-all, end-for-everyone, and scheduled-room cancellation.

Destructive room actions require confirmation. Mute-all is lower-role only and explicitly does not offer remote unmute. Supabase RPCs enforce hierarchy and audit actor/target/reason/action/time. Realtime synchronizes room/session status; participant reconciliation synchronizes role and media-policy changes. Automatic host departure promotes an active cohost or ends the meeting when none remains.

Validation commands:

- `node scripts/meeting-host-controls-smoke.mjs`
- `node scripts/meeting-participant-context-menu-smoke.mjs`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run performance:budget:ci`
- `npm run qa:smoke`

Hosted Supabase pgTAP, two-client Realtime, and real LiveKit moderation remain BLOCKED until protected staging credentials and provider infrastructure are available. Structural checks do not claim hosted success.
