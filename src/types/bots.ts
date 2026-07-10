export type BotProfile = Readonly<{ id: string; ownerId: string; displayName: string; avatarUrl?: string; communityId: string; roleId: string; isBot: true; createdAt: string }>;

export type BotCredentialStatus = Readonly<{
  botId: string;
  configured: boolean;
  tokenPrefix: string | null;
  createdAt: string | null;
  revokedAt: string | null;
  rateLimitPerMinute: number;
}>;

export type IssuedBotToken = Readonly<{
  botId: string;
  rawToken: string;
  tokenPrefix: string;
  createdAt: string;
  shownOnce: true;
}>;
