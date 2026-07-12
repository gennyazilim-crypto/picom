import type {
  MeetingWaitingBulkResult,
  MeetingWaitingEntry,
  MeetingWaitingRequestInput,
  MeetingWaitingRequestResult,
  MeetingWaitingServiceResult,
  MeetingWaitingStatus,
} from "../../types/meetingWaitingRoom";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";

const mockEntries = new Map<string, MeetingWaitingEntry>();

function fail<T>(code: string, message: string): MeetingWaitingServiceResult<T> {
  return { ok: false, error: { code, message } };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function string(value: unknown): string { return typeof value === "string" ? value : ""; }
function nullableString(value: unknown): string | null { return typeof value === "string" ? value : null; }

export function mapMeetingWaitingEntry(value: unknown): MeetingWaitingEntry | null {
  const row = record(value);
  if (!row) return null;
  const role = string(row.requestedRole ?? row.requested_role) as MeetingWaitingEntry["requestedRole"];
  const status = string(row.status) as MeetingWaitingStatus;
  const id = string(row.id), roomId = string(row.roomId ?? row.room_id), userId = string(row.userId ?? row.user_id);
  if (!id || !roomId || !userId || !["host", "cohost", "speaker", "participant", "viewer", "guest"].includes(role) || !["waiting", "admitted", "denied", "expired", "cancelled"].includes(status)) return null;
  return {
    id, roomId, sessionId: nullableString(row.sessionId ?? row.session_id), userId,
    displayName: string(row.displayName ?? row.display_name), requestedRole: role, status,
    requestMessage: string(row.requestMessage ?? row.request_message), inviteId: nullableString(row.inviteId ?? row.invite_id),
    invitedByUserId: nullableString(row.invitedByUserId ?? row.invited_by_user_id), requestedAt: string(row.requestedAt ?? row.requested_at),
    expiresAt: string(row.expiresAt ?? row.expires_at), resolvedAt: nullableString(row.resolvedAt ?? row.resolved_at),
    resolvedByUserId: nullableString(row.resolvedByUserId ?? row.resolved_by_user_id), denialReasonCode: nullableString(row.denialReasonCode ?? row.denial_reason_code),
    decisionNote: nullableString(row.decisionNote ?? row.decision_note), decisionMetadata: record(row.decisionMetadata ?? row.decision_metadata) ?? {},
    cancelledAt: nullableString(row.cancelledAt ?? row.cancelled_at), hostNotifiedAt: nullableString(row.hostNotifiedAt ?? row.host_notified_at),
    updatedAt: string(row.updatedAt ?? row.updated_at) || new Date().toISOString(),
  };
}

function mapRequest(value: unknown): MeetingWaitingRequestResult | null {
  const row = record(value); if (!row) return null;
  const disposition = string(row.disposition) as MeetingWaitingRequestResult["disposition"];
  if (!["direct", "waiting", "admitted"].includes(disposition)) return null;
  const entry = row.entry === null || row.entry === undefined ? null : mapMeetingWaitingEntry(row.entry);
  return row.entry && !entry ? null : { disposition, entry };
}

function mockEntry(input: MeetingWaitingRequestInput): MeetingWaitingEntry {
  const now = new Date();
  return { id: crypto.randomUUID(), roomId: input.roomId, sessionId: input.sessionId, userId: input.mockIdentity?.userId ?? "mock-waiting-user", displayName: input.mockIdentity?.displayName ?? "Waiting participant", requestedRole: input.mockIdentity?.role ?? "participant", status: "waiting", requestMessage: input.message?.trim().slice(0, 280) ?? "", inviteId: null, invitedByUserId: null, requestedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(), resolvedAt: null, resolvedByUserId: null, denialReasonCode: null, decisionNote: null, decisionMetadata: {}, cancelledAt: null, hostNotifiedAt: now.toISOString(), updatedAt: now.toISOString() };
}

function updateMock(entry: MeetingWaitingEntry, status: MeetingWaitingStatus, note: string | null, actor = "mock-host"): MeetingWaitingEntry {
  const now = new Date().toISOString();
  const updated: MeetingWaitingEntry = { ...entry, status, resolvedAt: now, resolvedByUserId: actor, denialReasonCode: status === "denied" ? "host_denied" : null, decisionNote: note, decisionMetadata: { source: status === "cancelled" ? "requester" : "host" }, cancelledAt: status === "cancelled" ? now : null, updatedAt: now };
  mockEntries.set(updated.id, updated); return updated;
}

export const meetingWaitingRoomService = {
  async request(input: MeetingWaitingRequestInput): Promise<MeetingWaitingServiceResult<MeetingWaitingRequestResult>> {
    if (!input.roomId || !input.sessionId || (input.message?.length ?? 0) > 280) return fail("MEETING_WAITING_INVALID", "Choose a valid meeting and keep the request message under 280 characters.");
    if (dataSourceService.getStatus().isMock) {
      const existing = [...mockEntries.values()].find((item) => item.roomId === input.roomId && item.sessionId === input.sessionId && item.userId === (input.mockIdentity?.userId ?? "mock-waiting-user") && ["waiting", "admitted"].includes(item.status));
      if (existing) return { ok: true, data: { disposition: existing.status === "admitted" ? "admitted" : "waiting", entry: existing } };
      const entry = mockEntry(input); mockEntries.set(entry.id, entry); return { ok: true, data: { disposition: "waiting", entry } };
    }
    const client = getSupabaseClient(); if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("request_meeting_waiting_admission", { target_room_id: input.roomId, target_session_id: input.sessionId, target_request_message: input.message?.trim() ?? "", target_idempotency_key: input.idempotencyKey ?? crypto.randomUUID() });
    const mapped = mapRequest(data); const limited = error?.message.includes("RATE_LIMITED") === true; return error || !mapped ? fail(limited ? "MEETING_WAITING_RATE_LIMITED" : "MEETING_WAITING_REQUEST_FAILED", limited ? "Too many join requests were submitted. Please wait before trying again." : "Picom could not submit this join request.") : { ok: true, data: mapped };
  },

  async list(roomId: string): Promise<MeetingWaitingServiceResult<readonly MeetingWaitingEntry[]>> {
    if (dataSourceService.getStatus().isMock) return { ok: true, data: [...mockEntries.values()].filter((item) => item.roomId === roomId).sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt)) };
    const client = getSupabaseClient(); if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("list_meeting_waiting_entries", { target_room_id: roomId });
    const entries = Array.isArray(data) ? data.map(mapMeetingWaitingEntry).filter((item): item is MeetingWaitingEntry => Boolean(item)) : [];
    return error ? fail("MEETING_WAITING_LIST_FAILED", "Picom could not load waiting participants.") : { ok: true, data: entries };
  },

  async getMine(roomId: string, sessionId?: string | null): Promise<MeetingWaitingServiceResult<MeetingWaitingEntry | null>> {
    if (dataSourceService.getStatus().isMock) return { ok: true, data: [...mockEntries.values()].filter((item) => item.roomId === roomId && (!sessionId || item.sessionId === sessionId)).sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))[0] ?? null };
    const client = getSupabaseClient(); if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("get_my_meeting_waiting_entry", { target_room_id: roomId, target_session_id: sessionId ?? null });
    const entry = data ? mapMeetingWaitingEntry(data) : null; return error || (data && !entry) ? fail("MEETING_WAITING_LOAD_FAILED", "Picom could not load your waiting state.") : { ok: true, data: entry };
  },

  async resolve(entryId: string, decision: "admit" | "deny", note?: string): Promise<MeetingWaitingServiceResult<MeetingWaitingEntry>> {
    if (dataSourceService.getStatus().isMock) { const entry = mockEntries.get(entryId); return entry ? { ok: true, data: updateMock(entry, decision === "admit" ? "admitted" : "denied", note?.trim() || null) } : fail("MEETING_WAITING_NOT_FOUND", "This waiting request is unavailable."); }
    const client = getSupabaseClient(); if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("resolve_meeting_waiting_entry", { target_entry_id: entryId, target_decision: decision, target_decision_note: note?.trim() || null });
    const entry = mapMeetingWaitingEntry(data); return error || !entry ? fail("MEETING_WAITING_DECISION_FAILED", "Picom could not apply this waiting-room decision.") : { ok: true, data: entry };
  },

  async resolveAll(roomId: string, decision: "admit" | "deny", note?: string): Promise<MeetingWaitingServiceResult<MeetingWaitingBulkResult>> {
    if (dataSourceService.getStatus().isMock) { const entries = [...mockEntries.values()].filter((item) => item.roomId === roomId && item.status === "waiting").map((item) => updateMock(item, decision === "admit" ? "admitted" : "denied", note?.trim() || null)); return { ok: true, data: { affected: entries.length, entries } }; }
    const client = getSupabaseClient(); if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("resolve_all_meeting_waiting", { target_room_id: roomId, target_decision: decision, target_decision_note: note?.trim() || null });
    const row = record(data); const entries = Array.isArray(row?.entries) ? row.entries.map(mapMeetingWaitingEntry).filter((item): item is MeetingWaitingEntry => Boolean(item)) : [];
    return error || !row ? fail("MEETING_WAITING_BULK_FAILED", "Picom could not apply the bulk waiting-room decision.") : { ok: true, data: { affected: Number(row.affected) || 0, entries } };
  },

  async cancel(entryId: string): Promise<MeetingWaitingServiceResult<MeetingWaitingEntry>> {
    if (dataSourceService.getStatus().isMock) { const entry = mockEntries.get(entryId); return entry ? { ok: true, data: updateMock(entry, "cancelled", "Cancelled by requester.", entry.userId) } : fail("MEETING_WAITING_NOT_FOUND", "This waiting request is unavailable."); }
    const client = getSupabaseClient(); if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("cancel_meeting_waiting_request", { target_entry_id: entryId }); const entry = mapMeetingWaitingEntry(data);
    return error || !entry ? fail("MEETING_WAITING_CANCEL_FAILED", "Picom could not cancel this waiting request.") : { ok: true, data: entry };
  },

  async expire(roomId?: string | null): Promise<MeetingWaitingServiceResult<number>> {
    if (dataSourceService.getStatus().isMock) { let affected = 0; for (const entry of mockEntries.values()) if (entry.status === "waiting" && (!roomId || entry.roomId === roomId) && Date.parse(entry.expiresAt) <= Date.now()) { updateMock(entry, "expired", "Request expired automatically.", "system"); affected += 1; } return { ok: true, data: affected }; }
    const client = getSupabaseClient(); if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("expire_meeting_waiting_entries", { target_room_id: roomId ?? null }); return error ? fail("MEETING_WAITING_EXPIRY_FAILED", "Picom could not refresh waiting-room expiry.") : { ok: true, data: Number(data) || 0 };
  },
};
