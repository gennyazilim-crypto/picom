export type WebhookRecord = Readonly<{ id: string; communityId: string; channelId: string; name: string; avatarUrl?: string; createdBy: string; revokedAt?: string; createdAt: string; updatedAt: string }>;
export type CreatedWebhook = Readonly<{ webhook: WebhookRecord; endpointUrl: string; tokenOnce: string }>;
