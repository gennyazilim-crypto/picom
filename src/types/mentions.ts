import type { Attachment, ChannelId, CommunityId, MessageId, Reaction, UserId } from "./community";

export type MentionSource = "popular_feed" | "following";
export type MentionFeedTab = "feed" | "following";
export type MentionQuickFilter = "today" | "week" | "unread" | "saved";

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
  popularityScore?: number;
  isUnread?: boolean;
  isSaved?: boolean;
};
