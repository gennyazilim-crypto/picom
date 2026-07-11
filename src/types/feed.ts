import type { UnifiedContentMention } from "./contentMentions";
import type { ContentMentionSourceType } from "./contentMentions";

export type UnifiedFeedMode = "popular" | "following";
export type UnifiedFeedMetrics = Readonly<{ reactions: number; comments: number; listeners: number; mentionCount: number }>;
export type UnifiedFeedItem = Readonly<{
  feedItemId: string; mention: UnifiedContentMention; mentionedUserIds: readonly string[]; metrics: UnifiedFeedMetrics;
  isUnread: boolean; isSaved: boolean; isFollowRelated: boolean; rankingScore: number; rankingEpoch: string;
}>;
export type UnifiedFeedCursor = Readonly<{ rankingScore: number; createdAt: string; feedItemId: string; rankingEpoch: string }>;
export type UnifiedFeedEmptyState = "no_visible_mentions" | "no_followed_mentions" | null;
export type UnifiedFeedPage = Readonly<{
  items: readonly UnifiedFeedItem[]; nextCursor: UnifiedFeedCursor | null; rankingEpoch: string; emptyState: UnifiedFeedEmptyState;
}>;
export type UnifiedFeedQuery = Readonly<{
  mode: UnifiedFeedMode; cursor?: UnifiedFeedCursor | null; limit?: number;
  sourceTypes?: readonly ContentMentionSourceType[]; followedAuthorIds?: readonly string[];
  createdAfter?: string; unreadOnly?: boolean; savedOnly?: boolean;
}>;
