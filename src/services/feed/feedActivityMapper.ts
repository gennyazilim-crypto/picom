import type { Attachment, Reaction } from "../../types/community";
import type { MentionCommentPreview, MentionItem, MentionSource } from "../../types/mentions";
import type { UnifiedFeedItem } from "../../types/feed";

/**
 * Canonical UI model for Mention / Activity Feed cards.
 * Components must consume this shape — not raw RPC rows.
 */
export type FeedActivityItem = Readonly<{
  activityId: string;
  activityType: "mention" | "reply" | "reaction" | "audio";
  messageId: string;
  parentMessageId: string | null;
  channelId: string;
  communityId: string;
  authorId: string;
  authorDisplayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  verified: boolean;
  body: string;
  attachments: readonly Attachment[];
  reactions: readonly Reaction[];
  replyPreview: readonly MentionCommentPreview[];
  replyCount: number;
  saved: boolean;
  unread: boolean;
  createdAt: string;
  editedAt: string | null;
  rankingScore: number | null;
  rankingEpoch: string | null;
  source: MentionSource;
  tieBreakerId: string;
}>;

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function dedupeByActivityId(items: readonly FeedActivityItem[]): FeedActivityItem[] {
  const seen = new Set<string>();
  const out: FeedActivityItem[] = [];
  for (const item of items) {
    const key = item.messageId || item.activityId || item.tieBreakerId;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Map Mention Feed RPC / view projection into the canonical UI model. */
export function mapMentionItemToActivity(item: MentionItem): FeedActivityItem | null {
  if (!item?.messageId || !item.communityId || !item.channelId || !item.authorId) return null;
  const createdAt = safeString(item.createdAt);
  if (!createdAt) return null;
  return {
    activityId: safeString(item.id) || `mention-${item.messageId}`,
    activityType: "mention",
    messageId: item.messageId,
    parentMessageId: null,
    channelId: item.channelId,
    communityId: item.communityId,
    authorId: item.authorId,
    authorDisplayName: null,
    username: null,
    avatarUrl: null,
    verified: false,
    body: safeString(item.body),
    attachments: item.attachments ?? [],
    reactions: item.reactions ?? [],
    replyPreview: item.commentPreview ?? [],
    replyCount: Math.max(0, Number(item.commentCount) || 0),
    saved: item.isSaved === true,
    unread: item.isUnread === true,
    createdAt,
    editedAt: null,
    rankingScore: typeof item.popularityScore === "number" ? item.popularityScore : null,
    rankingEpoch: null,
    source: item.source === "following" ? "following" : "popular_feed",
    tieBreakerId: item.messageId,
  };
}

/** Map ranked unified feed row into the canonical UI model (text sources only). */
export function mapUnifiedFeedItemToActivity(item: UnifiedFeedItem): FeedActivityItem | null {
  const mention = item?.mention;
  if (!mention?.sourceId || !mention.communityId || !mention.authorId) return null;
  if (mention.sourceType !== "text_message" && mention.sourceType !== "radio_chat") return null;
  const channelId = mention.channelId;
  if (!channelId) return null;
  return {
    activityId: safeString(item.feedItemId) || `feed-${mention.sourceId}`,
    activityType: "mention",
    messageId: mention.sourceId,
    parentMessageId: mention.parentSourceId ?? null,
    channelId,
    communityId: mention.communityId,
    authorId: mention.authorId,
    authorDisplayName: null,
    username: null,
    avatarUrl: null,
    verified: false,
    body: safeString(mention.preview),
    attachments: [],
    reactions: [],
    replyPreview: [],
    replyCount: Math.max(0, Number(item.metrics?.comments) || 0),
    saved: item.isSaved === true,
    unread: item.isUnread === true,
    createdAt: safeString(mention.createdAt),
    editedAt: mention.updatedAt && mention.updatedAt !== mention.createdAt ? mention.updatedAt : null,
    rankingScore: Number(item.rankingScore) || 0,
    rankingEpoch: safeString(item.rankingEpoch) || null,
    source: item.isFollowRelated ? "following" : "popular_feed",
    tieBreakerId: item.feedItemId,
  };
}

export function mapMentionItemsToActivities(items: readonly MentionItem[]): FeedActivityItem[] {
  return dedupeByActivityId(items.map(mapMentionItemToActivity).filter((item): item is FeedActivityItem => item !== null));
}

export function activityToMentionItem(activity: FeedActivityItem): MentionItem {
  return {
    id: activity.activityId,
    source: activity.source,
    communityId: activity.communityId,
    channelId: activity.channelId,
    messageId: activity.messageId,
    authorId: activity.authorId,
    mentionedUserIds: [],
    body: activity.body,
    createdAt: activity.createdAt,
    attachments: [...activity.attachments],
    reactions: [...activity.reactions],
    commentCount: activity.replyCount,
    commentPreview: [...activity.replyPreview],
    popularityScore: activity.rankingScore ?? undefined,
    isUnread: activity.unread,
    isSaved: activity.saved,
  };
}

export function activitiesToMentionItems(items: readonly FeedActivityItem[]): MentionItem[] {
  return items.map(activityToMentionItem);
}
