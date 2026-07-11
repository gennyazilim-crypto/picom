export type MeetingChatContextKind = "linked_channel" | "dedicated_thread" | "meeting_source";

export type MeetingChatContext = Readonly<{
  roomId: string;
  sessionId: string | null;
  communityId: string;
  channelId: string;
  threadId: string | null;
  contextKind: MeetingChatContextKind;
  title: string;
  preserveAfterMeeting: boolean;
  guestAccessExpiresAt: string | null;
  canRead: boolean;
  canWrite: boolean;
  isGuest: boolean;
}>;

export type MeetingChatSendInput = Readonly<{
  context: MeetingChatContext;
  body: string;
  clientMessageId?: string | null;
  replyToMessageId?: string | null;
  attachmentIds?: readonly string[];
}>;

export type MeetingChatDeepLinkInput = Readonly<{
  communityId: string;
  channelId: string;
  roomId: string;
  sessionId?: string | null;
  messageId?: string | null;
}>;
