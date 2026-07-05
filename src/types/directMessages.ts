import type { UserStatus } from "./community";

export type DirectMessage = Readonly<{
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: string;
  isPlaceholder?: boolean;
}>;

export type DirectConversation = Readonly<{
  id: string;
  participantUserId: string;
  participantName: string;
  participantUsername: string;
  participantStatus: UserStatus;
  participantStatusText: string;
  lastMessagePreview: string;
  updatedAt: string;
  unreadCount: number;
  messages: DirectMessage[];
}>;
