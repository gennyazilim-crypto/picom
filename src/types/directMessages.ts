import type { UserStatus } from "./community";

export type DirectMessageAttachment = Readonly<{
  id: string;
  messageId?: string;
  type: "image" | "file";
  url: string;
  name: string;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  createdAt?: string;
}>;

export type DirectMessageReplyPreview = Readonly<{
  messageId: string;
  authorName: string;
  body: string;
}>;

export type DirectMessageReaction = Readonly<{
  emoji: string;
  count: number;
  reactedByCurrentUser?: boolean;
}>;

export type DirectMessage = Readonly<{
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: string;
  clientMessageId?: string;
  replyToMessageId?: string;
  editedAt?: string;
  deletedAt?: string;
  attachments?: readonly DirectMessageAttachment[];
  replyPreview?: DirectMessageReplyPreview;
  reactions?: readonly DirectMessageReaction[];
  isPlaceholder?: boolean;
}>;

export type DirectMessageCursor = Readonly<{ createdAt: string; id: string }>;

export type DirectMessagePage = Readonly<{
  items: DirectMessage[];
  hasMore: boolean;
  nextCursor?: DirectMessageCursor;
}>;

export type DirectSharedMediaItem = DirectMessageAttachment & Readonly<{
  messageId: string;
  createdAt: string;
}>;

export type DirectSharedMediaPage = Readonly<{
  items: DirectSharedMediaItem[];
  hasMore: boolean;
  nextCursor?: DirectMessageCursor;
}>;

export type DirectMutualCommunity = Readonly<{
  id: string;
  name: string;
}>;

export type DirectConversation = Readonly<{
  id: string;
  participantUserId: string;
  participantName: string;
  participantUsername: string;
  participantAvatarUrl?: string;
  participantStatus: UserStatus;
  participantStatusText: string;
  lastMessagePreview: string;
  updatedAt: string;
  unreadCount: number;
  muted?: boolean;
  mutedUntil?: string;
  archivedAt?: string;
  lastReadAt?: string;
  lastReadMessageId?: string;
  mutualCommunities?: readonly DirectMutualCommunity[];
  sharedMedia?: readonly DirectMessageAttachment[];
  messages: DirectMessage[];
}>;
