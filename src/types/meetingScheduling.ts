import type { MeetingJoinPolicy, MeetingRole, MeetingRoomStatus } from "./meeting";

export type MeetingReminderPolicy = Readonly<{
  enabled: boolean;
  minutesBefore: readonly number[];
}>;

export type MeetingScheduleInput = Readonly<{
  roomId: string;
  scheduledFor: string;
  scheduledEndAt: string;
  hostUserId?: string | null;
  cohostUserIds?: readonly string[];
  eventId?: string | null;
  reminderPolicy?: MeetingReminderPolicy;
}>;

export type MeetingScheduleSummary = Readonly<{
  roomId: string;
  eventId: string;
  communityId: string;
  scheduledFor: string;
  scheduledEndAt: string;
  hostUserId: string;
  cohostUserIds: readonly string[];
  reminderPolicy: MeetingReminderPolicy;
}>;

export type MeetingInviteLifecycleStatus = "active" | "accepted" | "declined" | "revoked" | "expired";

export type MeetingInviteSummary = Readonly<{
  id: string;
  roomId: string;
  sessionId: string | null;
  invitedUserId: string | null;
  invitedByUserId: string;
  role: MeetingRole;
  status: MeetingInviteLifecycleStatus;
  tokenHint: string;
  maxUses: number;
  useCount: number;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}>;

export type CreateMeetingInviteInput = Readonly<{
  roomId: string;
  sessionId?: string | null;
  invitedUserId?: string | null;
  role?: MeetingRole;
  expiresAt?: string;
  maxUses?: number;
}>;

export type CreatedMeetingInvite = Readonly<{
  invite: MeetingInviteSummary;
  secret: string;
  deepLink: string;
}>;

export type MeetingInviteValidation = Readonly<{
  valid: boolean;
  code: string;
  roomId?: string;
  sessionId?: string | null;
  role?: MeetingRole;
  expiresAt?: string | null;
  alreadyRedeemed?: boolean;
  usesRemaining?: number;
}>;

export type MeetingJoinPreview = Readonly<{
  roomId: string;
  communityId?: string;
  communityName?: string;
  roomTitle?: string;
  mode?: "voice" | "meeting" | "stage";
  status?: MeetingRoomStatus;
  joinPolicy?: MeetingJoinPolicy;
  waitingRoomEnabled?: boolean;
  scheduledFor?: string | null;
  scheduledEndAt?: string | null;
  canJoin: boolean;
  disposition?: "direct" | "waiting" | "denied";
  reason: string;
  invite?: MeetingInviteValidation;
}>;

export type MeetingSchedulingError = Readonly<{ code: string; message: string }>;
export type MeetingSchedulingResult<T> = Readonly<{ ok: true; data: T } | { ok: false; error: MeetingSchedulingError }>;
