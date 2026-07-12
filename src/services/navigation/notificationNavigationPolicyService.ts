import type { Community } from "../../types/community";
import type { DeepLinkAction } from "../deepLinkService";
import { canViewChannel, getCommunityAccess } from "../permissions/communityPermissions";
import { isV1ChannelTypeEnabled, isV1CommunityKindEnabled, isV1DeepLinkTypeEnabled } from "../../config/v1ReleaseScope";

type NavigationContext = Readonly<{
  isAuthenticated: boolean;
  currentUserId: string;
  communities: readonly Community[];
  blockedUserIds: readonly string[];
}>;

export type NotificationNavigationDecision = Readonly<{ allowed: true } | { allowed: false; reason: string }>;

function validate(action: DeepLinkAction, context: NavigationContext): NotificationNavigationDecision {
  if (!isV1DeepLinkTypeEnabled(action.type)) return { allowed: false, reason: "This destination is not included in Picom V1 Core." };
  if (action.type === "passwordRecovery" || action.type === "emailVerification" || action.type === "invite") return { allowed: true };
  if (!context.isAuthenticated) return { allowed: false, reason: "Sign in before opening this notification." };
  if (action.type === "friends") return { allowed: true };

  const community = context.communities.find((candidate) => candidate.id === action.communityId);
  if (!community) return { allowed: false, reason: "This destination is no longer available." };
  if (!isV1CommunityKindEnabled(community.kind)) return { allowed: false, reason: "This community type is not included in Picom V1 Core." };
  const access = getCommunityAccess(context.currentUserId, community);
  const canReadCommunity = access.isMember || access.canViewPublicContent;
  if (!canReadCommunity) return { allowed: false, reason: "This destination is private or no longer accessible." };

  if (action.type === "radio" && community.kind !== "radio") return { allowed: false, reason: "This Radio session is no longer available." };
  if (action.type === "podcast" && community.kind !== "podcast") return { allowed: false, reason: "This Podcast episode is no longer available." };
  if ((action.type === "meeting" || action.type === "meetingChat") && !access.isMember) return { allowed: false, reason: "Join this community before opening its meeting." };

  if ("channelId" in action && action.channelId) {
    const channel = community.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === action.channelId);
    if (!channel || !isV1ChannelTypeEnabled(channel.type) || !canViewChannel(access, channel)) return { allowed: false, reason: "This channel is private, outside V1 Core, or no longer accessible." };
  }

  return { allowed: true };
}

export const notificationNavigationPolicyService = { validate };
