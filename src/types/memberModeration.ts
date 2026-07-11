export type MemberModerationAction = "kick" | "ban" | "timeout" | "unban" | "untimeout";

export type MemberModerationResult = Readonly<{
  action: MemberModerationAction;
  targetUserId: string;
  timeoutUntil: string | null;
}>;

export type CommunityModerationState = Readonly<{
  recordType: "ban" | "timeout";
  userId: string;
  displayName: string;
  reason: string;
  actorId: string;
  expiresAt: string | null;
  createdAt: string;
}>;
