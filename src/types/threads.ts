export type ThreadRecord = Readonly<{ id: string; communityId: string; channelId: string; parentMessageId: string; name: string; createdBy: string; createdAt: string; archivedAt?: string }>;
export type ThreadMessage = Readonly<{ id: string; threadId: string; authorId: string; body: string; createdAt: string }>;
