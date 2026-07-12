import type { MeetingClientSnapshot } from "./meetingClient";

export type MeetingHostRoomState = Readonly<{
  roomId: string | null;
  sessionId: string | null;
  roomStatus: "scheduled" | "open" | "live" | "ended" | "cancelled" | "locked" | "unknown";
  sessionStatus: "preparing" | "live" | "reconnecting" | "ended" | "failed" | "unknown";
  locked: boolean;
  hostUserId: string | null;
  cohostUserIds: readonly string[];
  realtimeStatus: "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";
  error: string | null;
  updatedAt: string;
}>;

export type MeetingHostControlResult<T = true> = Readonly<
  { ok: true; data: T } | { ok: false; error: Readonly<{ code: string; message: string }> }
>;

export type MeetingBulkMuteResult = Readonly<{ affected: number; failed: number; total: number }>;
export type MeetingHostControlAction = "assign_cohost" | "remove_cohost" | "transfer_host" | "enable_screen_share" | "disable_screen_share";
export type MeetingHostSnapshotInput = Pick<MeetingClientSnapshot, "context" | "role" | "capabilities" | "participantIds" | "participantsById">;

