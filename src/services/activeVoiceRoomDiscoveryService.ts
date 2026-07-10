import type { Community } from "../types/community";
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

export const activeVoiceRoomDiscoveryService = {
  getVisibleRooms({ communities, currentUserId, voiceSnapshot, occupancyByChannelId = {} }: DiscoveryInput): ActiveVoiceRoomSummary[] {
    const isMock = dataSourceService.getStatus().isMock;
    const connected = voiceSnapshot.status === "connected" || voiceSnapshot.status === "reconnecting";

    return communities.flatMap((community) => {
      const access = getCommunityAccess(currentUserId, community);
      if (!access.isMember && !access.canViewPublicContent) return [];

      return community.categories.flatMap((category) => category.channels).flatMap((channel) => {
        if (channel.type !== "voice" || !canViewChannel(access, channel)) return [];

        const activeHere = connected && isCurrentRoom(voiceSnapshot.roomName, channel.id, channel.name);
        const suppliedOccupancy = occupancyByChannelId[channel.id];
        const participantCount = suppliedOccupancy?.participantCount ?? (activeHere ? voiceSnapshot.participants.length : isMock ? stableMockCount(channel.id) : 0);
        if (participantCount <= 0) return [];

        const safeParticipantNames = access.canViewMemberList
          ? (suppliedOccupancy?.participantNames ?? (activeHere ? voiceSnapshot.participants.map((participant) => participant.name) : community.members.filter((member) => member.status !== "offline").map((member) => member.displayName))).slice(0, 3)
          : [];

        return [{
          communityId: community.id,
          communityName: community.name,
          channelId: channel.id,
          channelName: channel.name,
          participantCount,
          participantNames: safeParticipantNames,
          isPrivate: Boolean(channel.isPrivate),
          canJoin: access.isMember,
          joinBlockedReason: access.isMember ? undefined : "Join this community before entering its voice rooms.",
          source: suppliedOccupancy || activeHere ? "realtime" : "mock",
        } satisfies ActiveVoiceRoomSummary];
      });
    });
  },
};
