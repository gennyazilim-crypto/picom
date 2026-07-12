import { meetingStore } from "../../stores/meetingStore";
import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingParticipantModerationAction } from "../../types/meetingParticipantControls";
import { dataSourceService } from "../dataSourceService";
import { voiceModerationService } from "../voiceModerationService";
import { meetingStageService } from "./meetingStageService";

export type MeetingParticipantModerationResult = Readonly<
  { ok: true; message: string } | { ok: false; message: string }
>;

function patchMockParticipant(participantId: string, action: Extract<MeetingParticipantModerationAction, "mute" | "remove" | "deny_screen_share">): void {
  const snapshot = meetingStore.getSnapshot();
  const participants = snapshot.participantIds
    .map((id) => snapshot.participantsById[id])
    .filter(Boolean)
    .map((participant) => participant.id !== participantId ? participant : {
      ...participant,
      microphoneEnabled: action === "mute" ? false : participant.microphoneEnabled,
      screenSharing: action === "deny_screen_share" ? false : participant.screenSharing,
      presence: action === "remove" ? "removed" as const : participant.presence,
    });
  meetingStore.replaceParticipants(snapshot.generation, action === "remove" ? participants.filter((participant) => participant.id !== participantId) : participants);
}

async function runProviderAction(snapshot: MeetingClientSnapshot, participant: MeetingClientParticipant, action: "mute" | "remove" | "deny_screen_share"): Promise<MeetingParticipantModerationResult> {
  if (!snapshot.context) return { ok: false, message: "Meeting context is no longer available." };
  const result = await voiceModerationService.moderate({
    scope: "meeting",
    roomId: snapshot.context.roomId,
    sessionId: snapshot.context.sessionId,
    targetParticipantId: participant.id,
    action,
  });
  if (!result.ok) return { ok: false, message: result.message };
  if (dataSourceService.getStatus().isMock) patchMockParticipant(participant.id, action);
  const message = action === "mute"
    ? `${participant.displayName} was muted for everyone.`
    : action === "remove"
      ? `${participant.displayName} was removed from the meeting.`
      : `${participant.displayName}'s screen share was stopped.`;
  return { ok: true, message };
}

export const meetingParticipantModerationService = {
  async perform(snapshot: MeetingClientSnapshot, participant: MeetingClientParticipant, action: MeetingParticipantModerationAction): Promise<MeetingParticipantModerationResult> {
    if (!snapshot.capabilities.canManageParticipants || participant.isLocal) return { ok: false, message: "You cannot moderate this meeting participant." };
    if (action === "promote" || action === "demote") {
      const result = action === "promote"
        ? await meetingStageService.promoteParticipant(participant.id, "Promoted from participant context menu")
        : await meetingStageService.demoteParticipant(participant.id, "Moved to audience from participant context menu");
      return result.ok
        ? { ok: true, message: action === "promote" ? `${participant.displayName} is now a speaker.` : `${participant.displayName} moved to the audience.` }
        : { ok: false, message: result.error.message };
    }
    return runProviderAction(snapshot, participant, action);
  },
};
