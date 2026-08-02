import type { Channel, Community, Message } from "../../types/community";
import { canViewChannel, getCommunityAccess } from "../permissions/communityPermissions";
import { getSupabaseClient } from "../supabase/supabaseClient";

export type FeedMessageDeepLinkInput = Readonly<{
  communityId: string;
  channelId?: string;
  messageId?: string;
  communities: readonly Community[];
  currentUserId: string;
  blockedUserIds: readonly string[];
}>;

export type FeedMessageDeepLinkResolution =
  | Readonly<{
      ok: true;
      community: Community;
      channel: Channel;
      messageId: string;
      authorId: string | null;
      localMessage: Message | null;
    }>
  | Readonly<{ ok: false; reason: string; code: FeedMessageDeepLinkDenyCode }>;

export type FeedMessageDeepLinkDenyCode =
  | "MISSING_TARGET"
  | "COMMUNITY_UNAVAILABLE"
  | "CHANNEL_UNAVAILABLE"
  | "MESSAGE_UNAVAILABLE"
  | "BLOCKED_AUTHOR"
  | "FOREIGN_DM"
  | "NON_MEMBER_PRIVATE"
  | "SERVER_DENIED";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function deny(code: FeedMessageDeepLinkDenyCode, reason: string): FeedMessageDeepLinkResolution {
  return { ok: false, code, reason };
}

function findChannel(community: Community, channelId: string): Channel | undefined {
  return community.categories.flatMap((category) => category.channels).find((channel) => channel.id === channelId);
}

/**
 * Canonical Feed/community message deep-link resolution.
 * Client access checks fail closed; optional Supabase read confirms deleted/private/RLS denial.
 */
export async function resolveFeedMessageDeepLink(
  input: FeedMessageDeepLinkInput,
): Promise<FeedMessageDeepLinkResolution> {
  const { communityId, channelId, messageId, communities, currentUserId, blockedUserIds } = input;
  if (!communityId || !channelId || !messageId) {
    return deny("MISSING_TARGET", "This message link is incomplete or invalid.");
  }
  if (!uuidPattern.test(communityId) || !uuidPattern.test(channelId) || !uuidPattern.test(messageId)) {
    return deny("MISSING_TARGET", "This message link is invalid.");
  }

  const community = communities.find((candidate) => candidate.id === communityId);
  if (!community) {
    return deny("COMMUNITY_UNAVAILABLE", "This destination is no longer available.");
  }

  const access = getCommunityAccess(currentUserId, community);
  const channel = findChannel(community, channelId);
  if (!channel || !canViewChannel(access, channel)) {
    if (!access.isMember && channel?.isPrivate) {
      return deny("NON_MEMBER_PRIVATE", "This channel is private or no longer accessible.");
    }
    return deny("CHANNEL_UNAVAILABLE", "This channel is private or no longer accessible.");
  }

  const localMessage = community.messages.find((message) => message.id === messageId && message.channelId === channelId) ?? null;
  if (localMessage?.deletedAt) {
    return deny("MESSAGE_UNAVAILABLE", "This message is no longer available.");
  }
  if (localMessage && blockedUserIds.includes(localMessage.authorId)) {
    return deny("BLOCKED_AUTHOR", "This message is unavailable because the author is blocked.");
  }

  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client
      .from("messages")
      .select("id,community_id,channel_id,author_id,deleted_at")
      .eq("id", messageId)
      .maybeSingle();

    if (error || !data || data.deleted_at) {
      return deny("SERVER_DENIED", "This message is no longer available or you do not have access.");
    }
    if (data.community_id !== communityId || data.channel_id !== channelId) {
      return deny("SERVER_DENIED", "This message link does not match a visible channel message.");
    }
    if (blockedUserIds.includes(data.author_id)) {
      return deny("BLOCKED_AUTHOR", "This message is unavailable because the author is blocked.");
    }
    return {
      ok: true,
      community,
      channel,
      messageId: data.id,
      authorId: data.author_id,
      localMessage,
    };
  }

  // Offline / unconfigured: allow only when the local workspace already has the live message.
  if (!localMessage) {
    return deny("MESSAGE_UNAVAILABLE", "This message is no longer available or you do not have access.");
  }

  return {
    ok: true,
    community,
    channel,
    messageId: localMessage.id,
    authorId: localMessage.authorId,
    localMessage,
  };
}

export const feedMessageDeepLinkService = {
  resolve: resolveFeedMessageDeepLink,
};
