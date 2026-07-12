import type { UnifiedContentMention } from "./contentMentions";
import type { ContentMentionSourceType } from "./contentMentions";

export const FEED_SOURCE_TYPES = [
  "text_message",
  "radio_session",
  "radio_comment",
  "podcast_episode",
  "podcast_comment",
] as const;

export type FeedSourceType = (typeof FEED_SOURCE_TYPES)[number];

export const FEED_CONTENT_KINDS = [
  "text_only",
  "image_only",
  "text_image",
  "video_only",
  "text_video",
  "image_video",
  "text_image_video",
] as const;

export type FeedContentKind = (typeof FEED_CONTENT_KINDS)[number];

export type FeedAuthorSummary = Readonly<{
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  verificationType?: "verified_user" | "picom_staff" | "verified_bot";
}>;

export type FeedCommunitySummary = Readonly<{
  id: string;
  name: string;
  iconUrl?: string;
  isOfficial?: boolean;
}>;

export type FeedEngagementSummary = Readonly<{
  uniqueExternalReactors: number;
  uniqueExternalCommenters: number;
  additionalReplyCount: number;
  uniqueExternalSavers: number;
  uniqueExternalViewers: number;
  externalSupporterCount: number;
  listenerCount?: number;
}>;

export type FeedSourceDeepLink =
  | Readonly<{ view: "community"; communityId: string; channelId: string; messageId: string }>
  | Readonly<{ view: "radio"; communityId?: string; channelId?: string; radioSessionId: string; commentId?: string }>
  | Readonly<{ view: "podcast"; communityId?: string; podcastEpisodeId: string; commentId?: string }>;

export type FeedSourceReference = Readonly<{
  type: FeedSourceType;
  id: string;
  parentId?: string;
  communityId?: string;
  channelId?: string;
  deepLink: FeedSourceDeepLink;
}>;

export type FeedUserState = Readonly<{
  isDirectMention: boolean;
  isUnread: boolean;
  isSaved: boolean;
  isFriendAuthored: boolean;
  isFriendEngaged: boolean;
  isRecentCommunity: boolean;
}>;

export type FeedSourceMetadata =
  | Readonly<{ type: "text_message"; contentKind: FeedContentKind }>
  | Readonly<{ type: "radio_session"; status: "scheduled" | "live" | "ended"; hostId: string; durationSeconds?: number; listenerCount: number; coverUrl?: string }>
  | Readonly<{ type: "radio_comment"; radioSessionId: string; hostId?: string }>
  | Readonly<{ type: "podcast_episode"; authorId: string; durationSeconds?: number; coverUrl?: string }>
  | Readonly<{ type: "podcast_comment"; podcastEpisodeId: string; authorId?: string }>;

export type FeedItem = Readonly<{
  id: string;
  source: FeedSourceReference;
  sourceMetadata: FeedSourceMetadata;
  author: FeedAuthorSummary;
  community?: FeedCommunitySummary;
  bodyPreview?: string;
  createdAt: string;
  updatedAt: string;
  engagement: FeedEngagementSummary;
  userState: FeedUserState;
}>;

export type UnifiedFeedMode = "popular" | "following";
export type UnifiedFeedMetrics = Readonly<{ reactions: number; comments: number; listeners: number; mentionCount: number }>;
export type UnifiedFeedItem = Readonly<{
  feedItemId: string; mention: UnifiedContentMention; mentionedUserIds: readonly string[]; metrics: UnifiedFeedMetrics;
  isUnread: boolean; isSaved: boolean; isFollowRelated: boolean; rankingScore: number; rankingEpoch: string;
}>;
export type UnifiedFeedCursor = Readonly<{ rankingScore: number; createdAt: string; feedItemId: string; rankingEpoch: string }>;
export type UnifiedFeedEmptyState = "no_visible_mentions" | "no_followed_mentions" | null;
export type UnifiedFeedPage = Readonly<{
  items: readonly UnifiedFeedItem[]; nextCursor: UnifiedFeedCursor | null; rankingEpoch: string; emptyState: UnifiedFeedEmptyState; isStale?: boolean;
}>;
export type UnifiedFeedQuery = Readonly<{
  mode: UnifiedFeedMode; cursor?: UnifiedFeedCursor | null; limit?: number;
  sourceTypes?: readonly ContentMentionSourceType[]; followedAuthorIds?: readonly string[];
  createdAfter?: string; unreadOnly?: boolean; savedOnly?: boolean;
}>;
