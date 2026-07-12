import type { Community, Channel } from "../../types/community";
import type { DirectConversation } from "../../types/directMessages";
import type { UpcomingEvent } from "../../types/events";
import type { GlobalNavigationBadgeState } from "../../types/globalNavigation";
import type { ActiveVoiceRoomSummary } from "../../types/voiceDiscovery";
import type { NotificationPolicyState } from "../notificationPolicyStateService";
import { isV1FeatureEnabled } from "../../config/v1ReleaseScope";

type BadgeDerivationInput = Readonly<{
  communities: readonly Community[];
  directConversations: readonly DirectConversation[];
  activeVoiceRooms: readonly ActiveVoiceRoomSummary[];
  visibleEvents: readonly UpcomingEvent[];
  blockedUserIds: readonly string[];
  notificationPolicy: NotificationPolicyState;
  canViewChannel: (community: Community, channel: Channel) => boolean;
  now?: number;
}>;

const isActiveMute = (conversation: DirectConversation, now: number) => (
  conversation.muted === true || Boolean(conversation.mutedUntil && Date.parse(conversation.mutedUntil) > now)
);

function deriveBadges(input: BadgeDerivationInput): GlobalNavigationBadgeState {
  const now = input.now ?? Date.now();
  const blocked = new Set(input.blockedUserIds);
  const mutedCommunities = new Set(input.notificationPolicy.mutedCommunityIds);
  const mutedChannels = new Set(input.notificationPolicy.mutedChannelIds);

  const directConversations = new Map(input.directConversations.map((conversation) => [conversation.id, conversation]));
  const dmUnread = [...directConversations.values()].reduce((total, conversation) => {
    if (conversation.archivedAt || blocked.has(conversation.participantUserId) || isActiveMute(conversation, now)) return total;
    return total + Math.max(0, conversation.unreadCount);
  }, 0);

  const countedChannels = new Set<string>();
  let communityUnread = 0;
  for (const community of input.communities) {
    if (mutedCommunities.has(community.id)) continue;
    for (const channel of community.categories.flatMap((category) => category.channels)) {
      const key = `${community.id}:${channel.id}`;
      if (countedChannels.has(key) || mutedChannels.has(channel.id) || !input.canViewChannel(community, channel)) continue;
      countedChannels.add(key);
      communityUnread += Math.max(0, channel.mentions ?? 0) || (channel.unread ? 1 : 0);
    }
  }

  const radioLive = input.notificationPolicy.doNotDisturb ? 0 : new Set(input.activeVoiceRooms
    .filter((room) => room.source === "realtime" && room.participantCount > 0)
    .filter((room) => input.communities.some((community) => community.id === room.communityId && community.kind === "radio"))
    .filter((room) => !mutedCommunities.has(room.communityId) && !mutedChannels.has(room.channelId))
    .map((room) => `${room.communityId}:${room.channelId}`)).size;

  const eventWindowEnd = now + (7 * 24 * 60 * 60 * 1000);
  const eventUpcoming = input.notificationPolicy.doNotDisturb ? 0 : new Set(input.visibleEvents
    .filter((event) => !event.cancelledAt && event.currentUserRsvp !== "not_going")
    .filter((event) => {
      const startsAt = Date.parse(event.startsAt);
      return Number.isFinite(startsAt) && startsAt >= now && startsAt <= eventWindowEnd;
    })
    .map((event) => event.id)).size;

  return {
    dmUnread,
    communityUnread,
    radioLive: isV1FeatureEnabled("radio") ? radioLive : 0,
    eventUpcoming: isV1FeatureEnabled("events") ? eventUpcoming : 0,
    bookmarkCount: 0,
  };
}

export const globalNavigationBadgeService = { deriveBadges };
