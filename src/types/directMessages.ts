import type { UserStatus } from "./community";

export type DirectMessageAttachment = Readonly<{
  id: string;
  type: "image" | "file";
  url: string;
  name: string;
  mimeType?: string;
  width?: number;
  height?: number;
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
  editedAt?: string;
  deletedAt?: string;
  attachments?: readonly DirectMessageAttachment[];
  replyPreview?: DirectMessageReplyPreview;
  reactions?: readonly DirectMessageReaction[];
  isPlaceholder?: boolean;
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
  participantVerified?: boolean;
  participantStatus: UserStatus;
  participantStatusText: string;
  lastMessagePreview: string;
  updatedAt: string;
  unreadCount: number;
  muted?: boolean;
  mutualCommunities?: readonly DirectMutualCommunity[];
  sharedMedia?: readonly DirectMessageAttachment[];
  messages: DirectMessage[];
}>;
