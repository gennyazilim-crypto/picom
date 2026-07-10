export type MemberModerationAction = "kick" | "ban" | "timeout";

export type MemberModerationResult = Readonly<{
  action: MemberModerationAction;
  targetUserId: string;
  timeoutUntil: string | null;
}>;
