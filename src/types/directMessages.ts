import type { UserStatus } from "./community";

export type DirectMessage = Readonly<{
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: string;
  clientMessageId?: string;
  editedAt?: string;
  deletedAt?: string;
  reactions?: ReadonlyArray<Readonly<{ emoji: string; count: number; reactedByCurrentUser?: boolean }>>;
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
