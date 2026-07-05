import type { Attachment, ChannelId, CommunityId, MessageId, Reaction, UserId } from "./community";

export type MentionSource = "popular_feed" | "following";
export type MentionFeedTab = "feed" | "following";
export type MentionQuickFilter = "today" | "week" | "unread" | "saved";

export type MentionCommentPreview = {
  id: string;
  authorId: UserId;
  body: string;
  createdAt: string;
};

export type MentionItem = {
  id: string;
  source: MentionSource;
  communityId: CommunityId;
  channelId: ChannelId;
  messageId: MessageId;
  authorId: UserId;
  mentionedUserIds: UserId[];
  body: string;
  title?: string;
  createdAt: string;
  attachments?: Attachment[];
  reactions?: Reaction[];
  viewCount?: number;
  commentCount?: number;
  commenterIds?: UserId[];
  commentPreview?: MentionCommentPreview[];
  popularityScore?: number;
  isUnread?: boolean;
  isSaved?: boolean;
};
