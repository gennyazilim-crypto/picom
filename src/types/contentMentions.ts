import type { AudioFeedItem } from "./audio";
import type { MentionItem } from "./mentions";

export const CONTENT_MENTION_SOURCE_TYPES = [
  "text_message",
  "radio_session",
  "radio_chat",
  "podcast_episode",
  "podcast_comment",
] as const;

export type ContentMentionSourceType = (typeof CONTENT_MENTION_SOURCE_TYPES)[number];

export type ContentMentionVisibilityContext = Readonly<{
  communityVisibility: "public" | "private" | "unknown";
  channelPrivate: boolean | null;
  publicReadEnabled: boolean;
}>;

export type UnifiedContentMention = Readonly<{
  id: string;
  sourceType: ContentMentionSourceType;
  sourceId: string;
  parentSourceId?: string;
  communityId: string;
  channelId?: string;
  authorId: string;
  mentionedUserId: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  visibility: ContentMentionVisibilityContext;
}>;

export type UnifiedContentMentionCursor = Readonly<{
  createdAt: string;
  id: string;
}>;

export type UnifiedContentMentionNavigation =
  | Readonly<{ kind: "channel"; communityId: string; channelId: string; messageId: string }>
  | Readonly<{ kind: "radio"; communityId: string; sessionId: string }>
  | Readonly<{ kind: "podcast"; communityId: string; episodeId: string; commentId?: string }>;

const MOCK_VISIBILITY: ContentMentionVisibilityContext = {
  communityVisibility: "public",
  channelPrivate: false,
  publicReadEnabled: true,
};

export function textMentionToUnified(item: MentionItem, mentionedUserId: string): UnifiedContentMention {
  return {
    id: `${item.id}:${mentionedUserId}`,
    sourceType: "text_message",
    sourceId: item.messageId,
    communityId: item.communityId,
    channelId: item.channelId,
    authorId: item.authorId,
    mentionedUserId,
    preview: item.body.slice(0, 500),
    createdAt: item.createdAt,
    updatedAt: item.createdAt,
    visibility: MOCK_VISIBILITY,
  };
}

export function audioMentionToUnified(
  item: AudioFeedItem,
  mentionedUserId: string,
  sourceIdOverride?: string,
): UnifiedContentMention | null {
  if (!item.isMention) return null;
  const isPodcastComment = item.type === "podcast_episode" && item.mentionSource === "episode_comment";
  const sourceType: ContentMentionSourceType = item.type === "podcast_episode"
    ? isPodcastComment ? "podcast_comment" : "podcast_episode"
    : "radio_session";
  const sourceId = sourceIdOverride ?? item.sourceId ?? item.id.replace(/^feed-/, "");
  return {
    id: `${sourceType}:${sourceId}:${mentionedUserId}`,
    sourceType,
    sourceId,
    parentSourceId: isPodcastComment ? item.sourceId : undefined,
    communityId: item.communityId,
    authorId: item.mentionAuthorUserId ?? item.authorUserId ?? item.hostUserId ?? "unknown-author",
    mentionedUserId,
    preview: (item.mentionHighlight ?? item.body).slice(0, 500),
    createdAt: item.createdAt,
    updatedAt: item.createdAt,
    visibility: MOCK_VISIBILITY,
  };
}

export function getUnifiedMentionNavigation(mention: UnifiedContentMention): UnifiedContentMentionNavigation | null {
  if ((mention.sourceType === "text_message" || mention.sourceType === "radio_chat") && mention.channelId) {
    return { kind: "channel", communityId: mention.communityId, channelId: mention.channelId, messageId: mention.sourceId };
  }
  if (mention.sourceType === "radio_session") {
    return { kind: "radio", communityId: mention.communityId, sessionId: mention.sourceId };
  }
  if (mention.sourceType === "podcast_episode") {
    return { kind: "podcast", communityId: mention.communityId, episodeId: mention.sourceId };
  }
  if (mention.sourceType === "podcast_comment" && mention.parentSourceId) {
    return { kind: "podcast", communityId: mention.communityId, episodeId: mention.parentSourceId, commentId: mention.sourceId };
  }
  return null;
}
