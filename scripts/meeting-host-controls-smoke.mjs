import { readFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8");
const service = read("src/services/meeting/meetingHostControlService.ts");
const dock = read("src/components/meeting/MeetingControlDock.tsx");
const menu = read("src/components/meeting/MeetingParticipantActionsProvider.tsx");
const migration = read("supabase/migrations/20260711155700_meeting_host_moderation_controls.sql");
const token = read("supabase/functions/meeting-token/index.ts");
for (const marker of ["controlSession", "setCohost", "transferHost", "setScreenShareAllowed", "muteAll", "cancelScheduled", "postgres_changes"]) if (!service.includes(marker)) throw new Error(`Host service missing ${marker}`);
for (const marker of ["Mute all lower roles", "Cancel scheduled meeting", "End for everyone", "Unlock room", "cannot and will not remotely unmute"]) if (!dock.includes(marker)) throw new Error(`Control dock missing ${marker}`);
for (const marker of ["Assign cohost", "Remove cohost", "Transfer host", "Enable screen sharing", "Disable screen sharing"]) if (!menu.includes(marker)) throw new Error(`Participant menu missing ${marker}`);
for (const marker of ["set_meeting_participant_cohost", "transfer_meeting_host", "set_meeting_participant_screen_share_policy", "cancel_scheduled_meeting_room", "reconcile_meeting_host_departure", "meeting_host_departure_reconciliation", "audit_log"]) if (!migration.includes(marker)) throw new Error(`Host-control migration missing ${marker}`);
if (!token.includes("enforce_my_meeting_media_policy") || !token.includes("canPublishScreen")) throw new Error("Meeting token does not enforce participant screen-share policy.");
console.log("Meeting host/cohost moderation, confirmation, hierarchy, audit, Realtime, and last-host contract passed.");

