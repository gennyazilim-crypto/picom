export type BotProfile = Readonly<{ id: string; ownerId: string; displayName: string; avatarUrl?: string; communityId: string; roleId: string; isBot: true; createdAt: string }>;
