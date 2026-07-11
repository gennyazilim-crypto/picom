import type { DeepLinkAction } from "../deepLinkService";
import type { MeetingJoinPreview } from "../../types/meetingScheduling";
import { meetingService } from "./meetingService";
import { meetingPreJoinService } from "./meetingPreJoinService";
import { meetingSchedulingService } from "./meetingSchedulingService";
import { meetingInviteCredentialService } from "./meetingInviteCredentialService";

type MeetingLinkAction = Extract<DeepLinkAction, { type: "meeting" }>;
export type MeetingInviteNavigationSnapshot = Readonly<{ status: "idle" | "loading" | "open" | "error"; preview: MeetingJoinPreview | null; message: string }>;
type Listener = () => void;
const listeners = new Set<Listener>();
let generation = 0;
let snapshot: MeetingInviteNavigationSnapshot = { status: "idle", preview: null, message: "" };
const publish = (next: MeetingInviteNavigationSnapshot) => { snapshot = next; for (const listener of listeners) listener(); };

export function meetingJoinReason(reason: string): string {
  const normalized = reason.toUpperCase();
  if (normalized.includes("EXPIRED")) return "This meeting invite expired.";
  if (normalized.includes("REVOKED")) return "This meeting invite was revoked.";
  if (normalized.includes("EXHAUSTED")) return "This meeting invite reached its use limit.";
  if (normalized.includes("BLOCKED") || normalized === "POLICY") return "Your account cannot join this meeting.";
  if (normalized === "ENDED") return "This meeting has ended.";
  if (normalized === "LOCKED") return "This meeting is locked.";
  if (normalized === "NOT_STARTED") return "This meeting has not started yet.";
  if (normalized === "INVITE_REQUIRED") return "A valid invite is required for this meeting.";
  if (normalized === "MEMBERSHIP_REQUIRED") return "Community membership is required for this meeting.";
  return "This meeting link is unavailable or no longer valid.";
}

export const meetingInviteNavigationService = {
  getSnapshot: () => snapshot,
  subscribe(listener: Listener): () => void { listeners.add(listener); return () => listeners.delete(listener); },
  async open(action: MeetingLinkAction): Promise<boolean> {
    const operation = ++generation;
    meetingInviteCredentialService.clear();
    publish({ status: "loading", preview: null, message: "Checking meeting access..." });
    const result = await meetingSchedulingService.getJoinPreview(action.roomId, action.inviteToken);
    if (operation !== generation) return false;
    if (!result.ok) { publish({ status: "error", preview: null, message: result.error.message }); return false; }
    const preview = result.data;
    if (!preview.canJoin) { publish({ status: "error", preview, message: meetingJoinReason(preview.reason) }); return false; }
    const sessionId = action.sessionId ?? preview.sessionId;
    if (!sessionId) { publish({ status: "error", preview, message: "The meeting session is not ready yet." }); return false; }
    if (action.inviteToken) meetingInviteCredentialService.set(action.roomId, action.inviteToken);
    const request = {
      roomId: action.roomId,
      sessionId,
      communityId: preview.communityId ?? action.communityId,
      communityName: preview.communityName,
      channelId: action.channelId ?? `meeting-room-${action.roomId}`,
      roomTitle: preview.roomTitle ?? "Picom meeting",
      roomMode: preview.mode ?? "meeting",
      requestedSources: { microphone: true, camera: preview.mode !== "voice", screenShare: false, data: true },
      mockDisposition: preview.disposition === "waiting" ? "waiting" as const : "authorized" as const,
      mockRole: preview.invite?.role,
    };
    await meetingService.prepare(request);
    meetingPreJoinService.configure(request, { communityName: preview.communityName ?? "Picom", roomTitle: preview.roomTitle ?? "Picom meeting", hostName: preview.hostName ?? "Meeting host", joinPolicy: preview.joinPolicy ?? "members", waitingRoomEnabled: preview.waitingRoomEnabled === true, guestNotice: preview.invite?.role === "guest" ? "Signed-in guest access applies only to this meeting." : undefined });
    publish({ status: "open", preview, message: preview.disposition === "waiting" ? "The host will review your request after PreJoin." : "Meeting access verified." });
    return true;
  },
  dismiss(): void {
    generation += 1;
    meetingInviteCredentialService.clear();
    meetingPreJoinService.dispose();
    publish({ status: "idle", preview: null, message: "" });
  },
};
