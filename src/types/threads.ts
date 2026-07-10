export type ThreadSummary = Readonly<{ replyCount: number; unreadCount: number; lastReplyAt?: string }>;
export type ThreadRecord = Readonly<{ id: string; communityId: string; channelId: string; parentMessageId: string; name: string; createdBy: string; createdAt: string; archivedAt?: string; summary?: ThreadSummary }>;
export type ThreadMessage = Readonly<{ id: string; threadId: string; authorId: string; body: string; createdAt: string }>;
