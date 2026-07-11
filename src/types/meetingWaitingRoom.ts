import type { MeetingRole } from "./meeting";

export type MeetingWaitingStatus = "waiting" | "admitted" | "denied" | "expired" | "cancelled";

export type MeetingWaitingEntry = Readonly<{
  id: string;
  roomId: string;
  sessionId: string | null;
  userId: string;
  displayName: string;
  requestedRole: MeetingRole;
  status: MeetingWaitingStatus;
  requestMessage: string;
  inviteId: string | null;
  invitedByUserId: string | null;
  requestedAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  denialReasonCode: string | null;
  decisionNote: string | null;
  decisionMetadata: Readonly<Record<string, unknown>>;
  cancelledAt: string | null;
  hostNotifiedAt: string | null;
  updatedAt: string;
}>;

export type MeetingWaitingRequestInput = Readonly<{
  roomId: string;
  sessionId: string;
  message?: string;
  idempotencyKey?: string;
  mockIdentity?: Readonly<{ userId: string; displayName: string; role?: MeetingRole }>;
}>;

export type MeetingWaitingRequestResult = Readonly<{
  disposition: "direct" | "waiting" | "admitted";
  entry: MeetingWaitingEntry | null;
}>;

export type MeetingWaitingBulkResult = Readonly<{ affected: number; entries: readonly MeetingWaitingEntry[] }>;
export type MeetingWaitingServiceResult<T> = Readonly<{ ok: true; data: T } | { ok: false; error: { code: string; message: string } }>;
export type MeetingWaitingRealtimeEvent = Readonly<{ eventType: "INSERT" | "UPDATE" | "DELETE"; entry: MeetingWaitingEntry; serverTimestamp: string }>;
