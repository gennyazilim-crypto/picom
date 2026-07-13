import type { VoiceParticipant, VoiceServiceSnapshot } from "../../services/voiceService";
import type { VoiceRoomOccupancy } from "../../types/voiceDiscovery";

function mapOccupancyParticipant(
  participant: NonNullable<VoiceRoomOccupancy["participants"]>[number],
  currentUserId: string,
): VoiceParticipant {
  return {
    identity: participant.identity,
    name: participant.name,
    isLocal: participant.identity === currentUserId,
    isSpeaking: participant.isSpeaking ?? false,
    isMicrophoneEnabled: participant.isMicrophoneEnabled ?? true,
    isCameraEnabled: false,
    connectionQuality: "unknown",
  };
}

export function resolveVoiceParticipants(
  snapshot: VoiceServiceSnapshot,
  channelId: string,
  voiceOccupancy?: VoiceRoomOccupancy,
  currentUserId?: string,
): VoiceParticipant[] {
  const connectedHere = (snapshot.status === "connected" || snapshot.status === "reconnecting")
    && snapshot.roomContext?.channelId === channelId;

  if (connectedHere && snapshot.participants.length) {
    return snapshot.participants;
  }

  if (voiceOccupancy?.participants?.length) {
    return voiceOccupancy.participants.map((participant) => mapOccupancyParticipant(participant, currentUserId ?? ""));
  }

  if (voiceOccupancy?.participantNames?.length) {
    return voiceOccupancy.participantNames.map((name, index) => ({
      identity: `${channelId}:${index}:${name}`,
      name,
      isLocal: false,
      isSpeaking: false,
      isMicrophoneEnabled: true,
      isCameraEnabled: false,
      connectionQuality: "unknown" as const,
    }));
  }

  return [];
}
