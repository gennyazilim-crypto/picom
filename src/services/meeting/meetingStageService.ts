import { meetingStore } from "../../stores/meetingStore";
import type { MeetingRole } from "../../types/meeting";
import type { MeetingHandQueueEntry } from "../../types/meetingSignals";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { meetingSignalService } from "./meetingSignalService";

export type MeetingStageAction = "promote" | "demote" | "remove";
export type MeetingStageActionResult = Readonly<{
  participantId: string;
  previousRole: MeetingRole;
  role: MeetingRole;
  action: MeetingStageAction;
  reauthorizationRequired: boolean;
}>;
export type MeetingStageServiceResult<T> = Readonly<
  { ok: true; data: T } | { ok: false; error: Readonly<{ code: string; message: string }> }
>;

const fail = <T>(code: string, message: string): MeetingStageServiceResult<T> => ({ ok: false, error: { code, message } });
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): string => typeof value === "string" ? value : "";
const isRole = (value: string): value is MeetingRole => ["host", "cohost", "speaker", "participant", "viewer", "guest"].includes(value);

function patchQueue(participantId: string, status: MeetingHandQueueEntry["stageRequestStatus"]): void {
  const snapshot = meetingStore.getSnapshot();
  const now = new Date().toISOString();
  const participant = snapshot.participantsById[participantId];
  const existing = snapshot.stageQueue?.find((entry) => entry.participantId === participantId);
  if (!participant && !existing) return;
  const next: MeetingHandQueueEntry = existing ? {
    ...existing,
    stageRequestStatus: status,
    stageRequestedAt: status === "requested" ? existing.stageRequestedAt ?? now : existing.stageRequestedAt,
    stageResolvedAt: status === "requested" ? null : now,
    serverVersion: existing.serverVersion + 1,
    updatedAt: now,
  } : {
    participantId,
    userId: participant?.userId ?? null,
    displayName: participant?.displayName ?? "Participant",
    meetingRole: participant?.role ?? "viewer",
    handRaised: status === "requested",
    handRaisedAt: status === "requested" ? now : null,
    handSequence: (snapshot.stageQueue?.length ?? 0) + 1,
    acknowledgedByUserId: null,
    acknowledgedAt: null,
    stageRequestStatus: status,
    stageRequestedAt: status === "requested" ? now : null,
    stageResolvedAt: status === "requested" ? null : now,
    stageResolvedByUserId: null,
    serverVersion: 1,
    updatedAt: now,
  };
  const queue = [...(snapshot.stageQueue ?? []).filter((entry) => entry.participantId !== participantId), next]
    .sort((left, right) => (left.stageRequestedAt ?? left.updatedAt).localeCompare(right.stageRequestedAt ?? right.updatedAt));
  meetingStore.patch(snapshot.generation, { stageQueue: queue });
}

function patchMockRole(participantId: string, role: MeetingRole, action: MeetingStageAction): MeetingStageServiceResult<MeetingStageActionResult> {
  const snapshot = meetingStore.getSnapshot();
  const participant = snapshot.participantsById[participantId];
  if (!participant) return fail("MEETING_STAGE_PARTICIPANT_MISSING", "This participant is no longer in the meeting.");
  const participants = snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter(Boolean).map((item) => item.id === participantId ? { ...item, role } : item);
  meetingStore.replaceParticipants(snapshot.generation, participants);
  patchQueue(participantId, action === "promote" ? "approved" : "denied");
  return { ok: true, data: { participantId, previousRole: participant.role, role, action, reauthorizationRequired: participant.isLocal } };
}

async function manage(participantId: string, action: MeetingStageAction, reason: string): Promise<MeetingStageServiceResult<MeetingStageActionResult>> {
  if (!participantId) return fail("MEETING_STAGE_PARTICIPANT_INVALID", "Choose an active meeting participant.");
  const role: MeetingRole = action === "promote" ? "speaker" : "viewer";
  if (dataSourceService.getStatus().isMock) return patchMockRole(participantId, role, action);
  const client = getSupabaseClient();
  if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
  const { data, error } = await client.rpc("manage_meeting_stage_participant", { target_participant_id: participantId, stage_action: action, change_reason: reason.trim() || `Stage ${action}` });
  const row = record(data);
  const previousRole = text(row?.previousRole ?? row?.previous_role);
  const nextRole = text(row?.role);
  if (error || !row || !isRole(previousRole) || !isRole(nextRole)) return fail("MEETING_STAGE_ACTION_FAILED", "Picom could not update this stage participant.");
  return { ok: true, data: { participantId: text(row.participantId ?? row.participant_id) || participantId, previousRole, role: nextRole, action, reauthorizationRequired: row.reauthorizationRequired === true || row.reauthorization_required === true } };
}

async function signal(participantId: string, action: "request_stage" | "cancel_stage" | "deny_stage"): Promise<MeetingStageServiceResult<MeetingHandQueueEntry>> {
  if (dataSourceService.getStatus().isMock) {
    const status = action === "request_stage" ? "requested" : action === "cancel_stage" ? "cancelled" : "denied";
    patchQueue(participantId, status);
    const entry = meetingStore.getSnapshot().stageQueue?.find((item) => item.participantId === participantId);
    return entry ? { ok: true, data: entry } : fail("MEETING_STAGE_PARTICIPANT_MISSING", "This participant is no longer in the meeting.");
  }
  const result = await meetingSignalService.applyHandAction(participantId, action);
  return result.ok ? result : fail(result.error.code, result.error.message);
}

export const meetingStageService = {
  requestToSpeak: (participantId: string) => signal(participantId, "request_stage"),
  cancelRequest: (participantId: string) => signal(participantId, "cancel_stage"),
  denyRequest: (participantId: string) => signal(participantId, "deny_stage"),
  approveRequest: (participantId: string, reason = "Approved stage request") => manage(participantId, "promote", reason),
  promoteParticipant: (participantId: string, reason = "Promoted to stage") => manage(participantId, "promote", reason),
  demoteParticipant: (participantId: string, reason = "Moved to audience") => manage(participantId, "demote", reason),
  removeFromStage: (participantId: string, reason = "Removed from stage") => manage(participantId, "remove", reason),
  getPendingRequests: (): readonly MeetingHandQueueEntry[] => (meetingStore.getSnapshot().stageQueue ?? []).filter((entry) => entry.stageRequestStatus === "requested"),
};
