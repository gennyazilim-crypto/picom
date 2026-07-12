import type { Channel, Community } from "../types/community";
import type { CommunityAccess } from "../types/communityAccess";
import type { VoiceServiceSnapshot } from "./voiceService";
import type { ActiveVoiceRoomSummary, VoiceRoomOccupancy } from "../types/voiceDiscovery";
import { dataSourceService } from "./dataSourceService";
import { canViewChannel, getCommunityAccess } from "./permissions/communityPermissions";

type DiscoveryInput = Readonly<{
  communities: Community[];
  currentUserId: string;
  voiceSnapshot: VoiceServiceSnapshot;
  occupancyByChannelId?: Readonly<Record<string, VoiceRoomOccupancy>>;
}>;

const stableMockCount = (channelId: string) => (Array.from(channelId).reduce((total, value) => total + value.charCodeAt(0), 0) % 5) + 1;

const isCurrentRoom = (roomName: string | null, channelId: string, channelName: string) => {
  if (!roomName) return false;
  const normalized = roomName.toLowerCase();
  return normalized === channelId.toLowerCase() || normalized === channelName.toLowerCase() || normalized.endsWith(`:${channelId.toLowerCase()}`);
};

function resolveVoiceChannelOccupancy(
  channel: Channel,
  community: Community,
  access: CommunityAccess,
  voiceSnapshot: VoiceServiceSnapshot,
  suppliedOccupancy: VoiceRoomOccupancy | undefined,
  isMock: boolean,
  connected: boolean,
): VoiceRoomOccupancy | null {
  const activeHere = connected && (
    voiceSnapshot.roomContext?.channelId === channel.id
    || isCurrentRoom(voiceSnapshot.roomName, channel.id, channel.name)
  );
  const participantCount = suppliedOccupancy?.participantCount ?? (activeHere ? voiceSnapshot.participants.length : isMock ? stableMockCount(channel.id) : 0);
  if (participantCount <= 0) return null;

  if (suppliedOccupancy?.participants?.length) {
    return suppliedOccupancy;
  }

  if (activeHere) {
    return {
      participantCount: voiceSnapshot.participants.length,
      participantNames: voiceSnapshot.participants.map((participant) => participant.name),
      participants: voiceSnapshot.participants.map((participant) => ({
        identity: participant.identity,
        name: participant.name,
        isSpeaking: participant.isSpeaking,
        isMicrophoneEnabled: participant.isMicrophoneEnabled,
      })),
    };
  }

  const participantNames = access.canViewMemberList
    ? (suppliedOccupancy?.participantNames ?? community.members.filter((member) => member.status !== "offline").map((member) => member.displayName)).slice(0, participantCount)
    : [];

  return {
    participantCount,
    participantNames,
    participants: participantNames.map((name, index) => ({
      identity: `${channel.id}:${index}:${name}`,
      name,
    })),
  };
}

export const activeVoiceRoomDiscoveryService = {
  getOccupancyByChannelId({ communities, currentUserId, voiceSnapshot, occupancyByChannelId = {} }: DiscoveryInput): Record<string, VoiceRoomOccupancy> {
    const isMock = dataSourceService.getStatus().isMock;
    const connected = voiceSnapshot.status === "connected" || voiceSnapshot.status === "reconnecting";
    const occupancy: Record<string, VoiceRoomOccupancy> = {};

    for (const community of communities) {
      const access = getCommunityAccess(currentUserId, community);
      if (!access.isMember && !access.canViewPublicContent) continue;

      for (const channel of community.categories.flatMap((category) => category.channels)) {
        if (channel.type !== "voice" || !canViewChannel(access, channel)) continue;
        const resolved = resolveVoiceChannelOccupancy(
          channel,
          community,
          access,
          voiceSnapshot,
          occupancyByChannelId[channel.id],
          isMock,
          connected,
        );
        if (resolved) occupancy[channel.id] = resolved;
      }
    }

    return occupancy;
  },

  getVisibleRooms({ communities, currentUserId, voiceSnapshot, occupancyByChannelId = {} }: DiscoveryInput): ActiveVoiceRoomSummary[] {
    const isMock = dataSourceService.getStatus().isMock;
    const connected = voiceSnapshot.status === "connected" || voiceSnapshot.status === "reconnecting";

    return communities.flatMap((community) => {
      const access = getCommunityAccess(currentUserId, community);
      if (!access.isMember && !access.canViewPublicContent) return [];

      return community.categories.flatMap((category) => category.channels).flatMap((channel) => {
        if (channel.type !== "voice" || !canViewChannel(access, channel)) return [];

        const resolved = resolveVoiceChannelOccupancy(
          channel,
          community,
          access,
          voiceSnapshot,
          occupancyByChannelId[channel.id],
          isMock,
          connected,
        );
        if (!resolved) return [];

        const safeParticipantNames = access.canViewMemberList ? (resolved.participantNames ?? []).slice(0, 3) : [];

        return [{
          communityId: community.id,
          communityName: community.name,
          channelId: channel.id,
          channelName: channel.name,
          participantCount: resolved.participantCount,
          participantNames: safeParticipantNames,
          isPrivate: Boolean(channel.isPrivate),
          canJoin: access.isMember,
          joinBlockedReason: access.isMember ? undefined : "Join this community before entering its voice rooms.",
          source: occupancyByChannelId[channel.id] || (voiceSnapshot.roomContext?.channelId === channel.id && connected) ? "realtime" : "mock",
        } satisfies ActiveVoiceRoomSummary];
      });
    });
  },
};
