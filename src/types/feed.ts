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
  isHidden: boolean;
}>;

export type FeedMediaSummary = Readonly<{ id: string; type: "image" | "video"; url: string; thumbnailUrl?: string; fileName?: string; width?: number; height?: number }>;
export type FeedReactionSummary = Readonly<{ emoji: string; count: number; reactedByCurrentUser: boolean }>;
export type FeedCommenterSummary = Readonly<{ id: string; displayName: string; username: string; avatarUrl?: string }>;
export type FeedScoreSummary = Readonly<{ version: number; base: number; raw: number; relevance: number; freshness: number; final: number; groupPriority: number }>;

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
  title?: string;
  bodyPreview?: string;
  media: readonly FeedMediaSummary[];
  reactions: readonly FeedReactionSummary[];
  commenters: readonly FeedCommenterSummary[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  engagement: FeedEngagementSummary;
  userState: FeedUserState;
  score: FeedScoreSummary;
  sourceStatus: "ready" | "deleted" | "access_lost";
}>;

export type FeedMode = "feed" | "friends";
export type FeedCursor = Readonly<{ groupPriority:number;finalScore:number;createdAt:string;feedItemId:string;asOf:string }>;
export type FeedQuery = Readonly<{ mode:FeedMode;cursor?:FeedCursor|null;limit?:number;sourceTypes?:readonly FeedSourceType[];unreadOnly?:boolean;savedOnly?:boolean;communityId?:string }>;
export type FeedPage = Readonly<{ items:readonly FeedItem[];nextCursor:FeedCursor|null;asOf:string;emptyState:"no_items"|"no_friend_items"|"filtered_empty"|null }>;
export type FeedServiceErrorCode = "FEED_BACKEND_UNAVAILABLE"|"FEED_REQUEST_FAILED"|"FEED_ACCESS_LOST"|"FEED_INVALID_RESPONSE"|"FEED_STATE_FAILED";
export type FeedServiceResult<T> = Readonly<{ok:true;data:T}|{ok:false;error:Readonly<{code:FeedServiceErrorCode;message:string;retryable:boolean}>}>;

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
