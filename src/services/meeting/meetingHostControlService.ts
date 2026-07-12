import type { RealtimeChannel } from "@supabase/supabase-js";
import { meetingStore } from "../../stores/meetingStore";
import type { MeetingClientParticipant, MeetingClientSnapshot } from "../../types/meetingClient";
import type { MeetingBulkMuteResult, MeetingHostControlResult, MeetingHostRoomState } from "../../types/meetingHostControls";
import { dataSourceService } from "../dataSourceService";
import { mapRealtimeSubscriptionStatus } from "../supabase/realtimeService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import { voiceModerationService } from "../voiceModerationService";

type RpcClient = Readonly<{ rpc: (name: string, args?: Record<string, unknown>) => Promise<Readonly<{ data: unknown; error: { message: string } | null }>> }>;
type Row = Record<string, unknown>;
const listeners = new Set<() => void>();
let channel: RealtimeChannel | null = null;
let bindingGeneration = 0;
let state: MeetingHostRoomState = { roomId: null, sessionId: null, roomStatus: "unknown", sessionStatus: "unknown", locked: false, hostUserId: null, cohostUserIds: [], realtimeStatus: "idle", error: null, updatedAt: new Date(0).toISOString() };

const ok = <T>(data: T): MeetingHostControlResult<T> => ({ ok: true, data });
const fail = <T>(code: string, message: string): MeetingHostControlResult<T> => ({ ok: false, error: { code, message } });
const record = (value: unknown): Row | null => value && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
const text = (value: unknown): string => typeof value === "string" ? value : "";
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const roomStatuses = new Set(["scheduled", "open", "live", "ended", "cancelled", "locked"]);
const sessionStatuses = new Set(["preparing", "live", "reconnecting", "ended", "failed"]);

function publish(patch: Partial<MeetingHostRoomState>): void {
  state = Object.freeze({ ...state, ...patch, updatedAt: new Date().toISOString() });
  listeners.forEach((listener) => listener());
}

function mapState(value: unknown, fallback = state): MeetingHostRoomState | null {
  const row = record(value); if (!row) return null;
  const roomStatus = text(row.roomStatus ?? row.room_status);
  const sessionStatus = text(row.sessionStatus ?? row.session_status);
  return {
    roomId: text(row.roomId ?? row.room_id) || fallback.roomId,
    sessionId: text(row.sessionId ?? row.session_id) || fallback.sessionId,
    roomStatus: roomStatuses.has(roomStatus) ? roomStatus as MeetingHostRoomState["roomStatus"] : fallback.roomStatus,
    sessionStatus: sessionStatuses.has(sessionStatus) ? sessionStatus as MeetingHostRoomState["sessionStatus"] : fallback.sessionStatus,
    locked: row.locked === true || roomStatus === "locked",
    hostUserId: text(row.hostUserId ?? row.host_user_id) || fallback.hostUserId,
    cohostUserIds: Array.isArray(row.cohostUserIds ?? row.cohost_user_ids) ? strings(row.cohostUserIds ?? row.cohost_user_ids) : fallback.cohostUserIds,
    realtimeStatus: fallback.realtimeStatus,
    error: null,
    updatedAt: text(row.updatedAt ?? row.updated_at) || new Date().toISOString(),
  };
}

function patchParticipant(participantId: string, patch: Partial<MeetingClientParticipant>): void {
  const snapshot = meetingStore.getSnapshot();
  meetingStore.replaceParticipants(snapshot.generation, snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter(Boolean).map((participant) => participant.id === participantId ? { ...participant, ...patch } : participant));
}

async function rpc<T>(name: string, args: Record<string, unknown>, mapper: (value: unknown) => T | null): Promise<MeetingHostControlResult<T>> {
  const client = getSupabaseClient(); if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase meeting controls are unavailable.");
  const { data, error } = await (client as unknown as RpcClient).rpc(name, args);
  const mapped = mapper(data);
  return error || mapped === null ? fail("MEETING_HOST_CONTROL_FAILED", error?.message ?? "Picom could not apply the meeting control.") : ok(mapped);
}

function publishRoomRow(value: unknown): void {
  const row = record(value); if (!row) return;
  const roomStatus = text(row.status);
  publish({ roomStatus: roomStatuses.has(roomStatus) ? roomStatus as MeetingHostRoomState["roomStatus"] : state.roomStatus, locked: roomStatus === "locked" || typeof row.locked_at === "string", hostUserId: text(row.host_user_id) || state.hostUserId, cohostUserIds: strings(row.cohost_user_ids), error: null });
}

function publishSessionRow(value: unknown): void {
  const row = record(value); if (!row) return;
  const sessionStatus = text(row.status);
  publish({ sessionStatus: sessionStatuses.has(sessionStatus) ? sessionStatus as MeetingHostRoomState["sessionStatus"] : state.sessionStatus, error: null });
}

async function load(roomId: string, sessionId: string): Promise<void> {
  if (dataSourceService.getStatus().isMock) return;
  const result = await rpc("get_meeting_host_control_state", { target_room_id: roomId, target_session_id: sessionId }, (value) => mapState(value));
  if (result.ok) state = result.data, listeners.forEach((listener) => listener());
  else publish({ error: result.error.message });
}

const rank: Record<string, number> = { host: 6, cohost: 5, speaker: 4, participant: 3, viewer: 2, guest: 1 };

export const meetingHostControlService = {
  subscribe(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); },
  getSnapshot(): MeetingHostRoomState { return state; },
  start(roomId: string, sessionId: string): () => void {
    const generation = ++bindingGeneration;
    if (channel) { const client = getSupabaseClient(); if (client) void client.removeChannel(channel); channel = null; }
    if (dataSourceService.getStatus().isMock) {
      const meeting = meetingStore.getSnapshot(); const local = meeting.participantIds.map((id) => meeting.participantsById[id]).find((participant) => participant?.isLocal);
      publish({ roomId, sessionId, roomStatus: "live", sessionStatus: "live", locked: false, hostUserId: meeting.role === "host" ? local?.userId ?? "mock-host" : "mock-host", cohostUserIds: meeting.participantIds.map((id) => meeting.participantsById[id]).filter((participant) => participant?.role === "cohost" && participant.userId).map((participant) => participant.userId!), realtimeStatus: "connected", error: null });
      return () => { if (generation === bindingGeneration) publish({ realtimeStatus: "disconnected" }); };
    }
    const status = getSupabaseClientStatus(), client = getSupabaseClient();
    if (!status.configured || !client) { publish({ roomId, sessionId, realtimeStatus: "disconnected", error: status.reason ?? "Meeting control Realtime is unavailable." }); return () => undefined; }
    publish({ roomId, sessionId, realtimeStatus: "connecting", error: null }); void load(roomId, sessionId);
    let connected = false;
    channel = client.channel(`meeting-host-controls:${roomId}:${sessionId}:${generation}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "meeting_rooms", filter: `id=eq.${roomId}` }, (payload) => { if (generation === bindingGeneration) publishRoomRow(payload.new); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "meeting_sessions", filter: `id=eq.${sessionId}` }, (payload) => { if (generation === bindingGeneration) publishSessionRow(payload.new); })
      .subscribe((value) => { if (generation !== bindingGeneration) return; const mapped = mapRealtimeSubscriptionStatus(value, connected); if (!mapped) return; if (mapped === "connected") connected = true; publish({ realtimeStatus: mapped, error: mapped === "disconnected" ? "Meeting control synchronization disconnected." : null }); });
    return () => { if (generation !== bindingGeneration) return; bindingGeneration += 1; const active = channel; channel = null; if (active) void client.removeChannel(active); publish({ realtimeStatus: "disconnected" }); };
  },
  async controlSession(action: "lock" | "unlock" | "end"): Promise<MeetingHostControlResult<{ roomId: string; sessionId: string; action: "lock" | "unlock" | "end"; status: string; locked: boolean; ended: boolean }>> {
    if (!state.roomId || !state.sessionId) return fail("MEETING_CONTEXT_INVALID", "Join a meeting before using room controls.");
    if (dataSourceService.getStatus().isMock) { const next = action === "end" ? "ended" : action === "lock" ? "locked" : "live"; publish({ roomStatus: next, sessionStatus: action === "end" ? "ended" : state.sessionStatus, locked: action === "lock" }); return ok({ roomId: state.roomId, sessionId: state.sessionId, action, status: next, locked: action === "lock", ended: action === "end" }); }
    const result = await rpc("control_meeting_session", { target_room_id: state.roomId, target_session_id: state.sessionId, control_action: action }, (value) => { const row = record(value); return row ? { roomId: text(row.roomId) || state.roomId!, sessionId: text(row.sessionId) || state.sessionId!, action, status: text(row.status), locked: row.locked === true, ended: row.ended === true } : null; });
    if (result.ok) publish({ roomStatus: result.data.status as MeetingHostRoomState["roomStatus"], sessionStatus: result.data.ended ? "ended" : state.sessionStatus, locked: result.data.locked, error: null });
    return result;
  },
  async setCohost(participant: MeetingClientParticipant, enabled: boolean, reason = "Updated from host participant controls"): Promise<MeetingHostControlResult<true>> {
    if (dataSourceService.getStatus().isMock) { patchParticipant(participant.id, { role: enabled ? "cohost" : "participant" }); publish({ cohostUserIds: enabled && participant.userId ? [...new Set([...state.cohostUserIds, participant.userId])] : state.cohostUserIds.filter((id) => id !== participant.userId) }); return ok(true); }
    const result = await rpc("set_meeting_participant_cohost", { target_participant_id: participant.id, target_enabled: enabled, change_reason: reason }, (value) => record(value) ? true : null);
    if (result.ok) patchParticipant(participant.id, { role: enabled ? "cohost" : "participant" });
    return result;
  },
  async transferHost(participant: MeetingClientParticipant, reason = "Host transferred from participant controls"): Promise<MeetingHostControlResult<true>> {
    if (dataSourceService.getStatus().isMock) { const snapshot = meetingStore.getSnapshot(); const local = snapshot.participantIds.map((id) => snapshot.participantsById[id]).find((item) => item?.isLocal); if (local) patchParticipant(local.id, { role: "cohost" }); patchParticipant(participant.id, { role: "host" }); publish({ hostUserId: participant.userId ?? state.hostUserId, cohostUserIds: local?.userId ? [...new Set([...state.cohostUserIds.filter((id) => id !== participant.userId), local.userId])] : state.cohostUserIds }); return ok(true); }
    const result = await rpc("transfer_meeting_host", { target_participant_id: participant.id, change_reason: reason }, (value) => record(value) ? true : null);
    return result;
  },
  async setScreenShareAllowed(participant: MeetingClientParticipant, allowed: boolean, reason = "Screen-share policy updated by meeting host"): Promise<MeetingHostControlResult<true>> {
    if (dataSourceService.getStatus().isMock) { patchParticipant(participant.id, { screenShareAllowed: allowed, screenSharing: allowed ? participant.screenSharing : false }); return ok(true); }
    const result = await rpc("set_meeting_participant_screen_share_policy", { target_participant_id: participant.id, target_allowed: allowed, change_reason: reason }, (value) => record(value) ? true : null);
    if (!result.ok) return result;
    patchParticipant(participant.id, { screenShareAllowed: allowed });
    if (!allowed && participant.screenSharing && state.roomId && state.sessionId) {
      const provider = await voiceModerationService.moderate({ scope: "meeting", roomId: state.roomId, sessionId: state.sessionId, targetParticipantId: participant.id, action: "deny_screen_share" });
      if (!provider.ok) return fail("MEETING_SCREEN_SHARE_STOP_FAILED", `${provider.message} Future screen-share tokens remain disabled.`);
    }
    return ok(true);
  },
  async muteAll(snapshot: MeetingClientSnapshot): Promise<MeetingHostControlResult<MeetingBulkMuteResult>> {
    if (!snapshot.context || !snapshot.role) return fail("MEETING_CONTEXT_INVALID", "Meeting context is unavailable.");
    const actorRank = rank[snapshot.role] ?? 0;
    const targets = snapshot.participantIds.map((id) => snapshot.participantsById[id]).filter((participant) => participant && !participant.isLocal && participant.microphoneEnabled && actorRank > (rank[participant.role] ?? 0));
    const results = await Promise.all(targets.map((participant) => voiceModerationService.moderate({ scope: "meeting", roomId: snapshot.context!.roomId, sessionId: snapshot.context!.sessionId, targetParticipantId: participant.id, action: "mute" })));
    const affected = results.filter((result) => result.ok).length;
    if (dataSourceService.getStatus().isMock) targets.forEach((participant) => patchParticipant(participant.id, { microphoneEnabled: false }));
    return ok({ affected, failed: results.length - affected, total: targets.length });
  },
  async cancelScheduled(reason: string): Promise<MeetingHostControlResult<true>> {
    if (!state.roomId) return fail("MEETING_CONTEXT_INVALID", "Meeting room is unavailable.");
    if (dataSourceService.getStatus().isMock) { publish({ roomStatus: "cancelled" }); return ok(true); }
    const result = await rpc("cancel_scheduled_meeting_room", { target_room_id: state.roomId, cancellation_reason: reason }, (value) => record(value) ? true : null);
    if (result.ok) publish({ roomStatus: "cancelled" });
    return result;
  },
};
