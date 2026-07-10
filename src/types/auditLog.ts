export type AuditActionType = "community_update" | "channel_create" | "channel_update" | "channel_delete" | "role_change" | "member_change" | "moderation_action" | "invite_create" | "invite_revoke" | "webhook_create" | "webhook_revoke";
export type AuditLogRecord = Readonly<{ id: string; communityId: string; actorId: string; actionType: AuditActionType; targetType: string; targetId?: string; reason?: string; createdAt: string }>;
export type AppendAuditLogInput = Omit<AuditLogRecord, "id" | "createdAt" | "actorId"> & { actorId?: string };
