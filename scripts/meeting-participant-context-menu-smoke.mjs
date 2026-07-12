import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const menu = read("src/components/meeting/MeetingParticipantActionsProvider.tsx");
const sharedMenu = read("src/components/DesktopContextMenu.tsx");
const provider = read("src/components/meeting/MeetingParticipantActionsProvider.tsx");
const local = read("src/services/meeting/meetingParticipantLocalControlService.ts");
const moderation = read("src/services/meeting/meetingParticipantModerationService.ts");
const voice = read("src/services/voiceService.ts");
const edge = read("supabase/functions/livekit-moderation/index.ts");
const migration = read("supabase/migrations/20260711155600_meeting_participant_context_controls.sql");

for (const marker of ["View profile", "Send message", "Mute locally", "Local volume", "Report participant", "Hide self view", "Mute participant", "Remove participant", "Move to audience", "Promote to speaker", "Stop screen share"]) {
  if (!menu.includes(marker)) throw new Error(`Participant menu is missing ${marker}`);
}
if (!sharedMenu.includes('role="menu"') || !sharedMenu.includes("ArrowDown") || !sharedMenu.includes("clampOverlayPosition") || !sharedMenu.includes("data-menu-focus")) throw new Error("Participant menu keyboard or viewport contract is missing.");
if (!local.includes("setParticipantLocalVolume") || !voice.includes("remoteParticipantVolumes") || !voice.includes("setRemoteParticipantVolume")) throw new Error("Local-only volume control is not provider-backed.");
if (!provider.includes("ReportModal") || !provider.includes("meetingParticipantNavigationService")) throw new Error("Existing report/profile/DM flows are not integrated.");
if (!moderation.includes("voiceModerationService") || !moderation.includes("meetingStageService")) throw new Error("Server moderation and stage services are not integrated.");
for (const marker of ["authorize_livekit_meeting_moderation", "record_livekit_meeting_moderation", "can_manage_meeting_participant", "provider_room_name", "provider_identity"]) if (!migration.includes(marker)) throw new Error(`Meeting moderation migration is missing ${marker}`);
if (!edge.includes('scope === "meeting"') || !edge.includes("matchesPicomMeetingLiveKitRoomName") || !edge.includes("TrackSource.SCREEN_SHARE")) throw new Error("Meeting provider moderation boundary is incomplete.");
console.log("Meeting participant context menu, local controls, navigation, report, and server moderation contract passed.");
