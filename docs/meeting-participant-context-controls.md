# Meeting Participant Context Controls

Task 556 adds one participant action surface across voice, grid, speaker, screen-share, and stage layouts.

## Control boundaries

- **Pin / unpin**, self-view visibility, per-participant volume, and **Mute locally** are local client preferences. They do not mutate another participant or publish a moderation event.
- Local volume uses the subscribed LiveKit audio track volume. The preference is re-applied when a remote audio track is subscribed.
- **Mute participant**, **Remove participant**, and **Stop screen share** call the authenticated `livekit-moderation` Edge Function with meeting room, session, and participant IDs. The Edge Function resolves provider room and identity only after `authorize_livekit_meeting_moderation` approves active-session membership and role hierarchy.
- Stage promotion/demotion continues through `meetingStageService` and its hierarchy-safe Supabase RPC.
- Provider identities are never rendered in the menu or supplied by arbitrary UI input.

## Navigation and safety

- View Profile and Send Message use the existing app-level profile and direct-message flows through `meetingParticipantNavigationService`.
- Report opens the existing `ReportModal`, which submits through `reportService`.
- Destructive removal requires a second confirmation click.
- The menu clamps to the desktop viewport, restores focus, supports Escape and arrow-key navigation, and keeps local and global mute labels distinct.

## Mock and hosted behavior

Mock mode simulates approved server actions and patches the meeting projection for deterministic UI testing. Supabase mode requires the migration and deployed Edge Function. Hosted authorization and LiveKit provider execution remain release-environment evidence; structural tests do not claim hosted success.

The renderer budget remains enforced. The existing Picom concept logo was losslessly re-encoded with identical dimensions and decoded pixels to offset the meeting menu bundle without raising any performance limit.
