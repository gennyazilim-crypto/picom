import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  DmCall,
  DmCallEvent,
  DmCallInvitation,
  DmCallInvitationStatus,
  DmCallParticipant,
  DmCallParticipantStatus,
  DmCallQualitySample,
  DmCallStatus,
  DmCallType,
} from "../../types/dmCalls";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import { loggingService } from "../loggingService";

type ServiceError = Readonly<{ code: string; message: string }>;
export type DmCallServiceResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: ServiceError }>;
type RpcError = Readonly<{ code?: string; message: string }>;
type RpcClient = Readonly<{
  rpc: (name: string, args?: Readonly<Record<string, unknown>>) => PromiseLike<Readonly<{ data: unknown; error: RpcError | null }>>;
}>;
type CallListener = (call: DmCall) => void;

const callStatuses = new Set<DmCallStatus>(["ringing", "active", "declined", "canceled", "missed", "busy", "failed", "completed"]);
const invitationStatuses = new Set<DmCallInvitationStatus>(["ringing", "accepted", "declined", "canceled", "missed", "busy"]);
const participantStatuses = new Set<DmCallParticipantStatus>(["invited", "connecting", "connected", "reconnecting", "disconnected", "left"]);
const localListeners = new Set<CallListener>();

function failure(code: string, message: string): DmCallServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown): number {
  const resolved = Number(value);
  return Number.isFinite(resolved) ? resolved : 0;
}

function mapParticipant(value: unknown): DmCallParticipant | null {
  const row = asRecord(value);
  const userId = optionalString(row.user_id);
  if (!userId) return null;
  const invitationStatus = invitationStatuses.has(row.invitation_status as DmCallInvitationStatus)
    ? row.invitation_status as DmCallInvitationStatus
    : "ringing";
  const finalStatus = participantStatuses.has(row.final_status as DmCallParticipantStatus)
    ? row.final_status as DmCallParticipantStatus
    : "invited";
  return {
    userId,
    displayName: optionalString(row.display_name) ?? "Picom member",
    username: optionalString(row.username) ?? "member",
    avatarUrl: optionalString(row.avatar_url),
    invitationStatus,
    joinedAt: optionalString(row.joined_at),
    leftAt: optionalString(row.left_at),
    microphoneEnabled: bool(row.microphone_enabled, true),
    cameraEnabled: bool(row.camera_enabled),
    screenShareEnabled: bool(row.screen_share_enabled),
    reconnectCount: Math.max(0, numberValue(row.reconnect_count)),
    finalStatus,
  };
}

function mapEvent(value: unknown): DmCallEvent | null {
  const row = asRecord(value);
  const id = optionalString(row.id);
  const callId = optionalString(row.call_id);
  const type = optionalString(row.event_type);
  const createdAt = optionalString(row.created_at);
  if (!id || !callId || !type || !createdAt) return null;
  return { id, callId, actorId: optionalString(row.actor_id), type, createdAt, metadata: asRecord(row.metadata) };
}

function mapInvitation(value: unknown): DmCallInvitation | undefined {
  const row = asRecord(value);
  const id = optionalString(row.id);
  const inviterId = optionalString(row.inviter_id);
  const inviteeId = optionalString(row.invitee_id);
  const expiresAt = optionalString(row.expires_at);
  const status = invitationStatuses.has(row.status as DmCallInvitationStatus) ? row.status as DmCallInvitationStatus : null;
  if (!id || !inviterId || !inviteeId || !expiresAt || !status) return undefined;
  return { id, inviterId, inviteeId, status, expiresAt, respondedAt: optionalString(row.responded_at), readAt: optionalString(row.read_at) };
}

export function mapDmCall(value: unknown): DmCall | null {
  const wrapper = asRecord(value);
  const row = "call" in wrapper ? asRecord(wrapper.call) : wrapper;
  const id = optionalString(row.id);
  const conversationId = optionalString(row.conversation_id);
  const livekitRoomName = optionalString(row.livekit_room_name);
  const createdBy = optionalString(row.created_by);
  const startedAt = optionalString(row.started_at);
  const createdAt = optionalString(row.created_at);
  const updatedAt = optionalString(row.updated_at);
  const status = callStatuses.has(row.status as DmCallStatus) ? row.status as DmCallStatus : null;
  const callType = row.call_type === "video" ? "video" : row.call_type === "voice" ? "voice" : null;
  if (!id || !conversationId || !livekitRoomName || !createdBy || !startedAt || !createdAt || !updatedAt || !status || !callType) return null;
  const participants = Array.isArray(row.participants) ? row.participants.map(mapParticipant).filter((item): item is DmCallParticipant => Boolean(item)) : [];
  const events = Array.isArray(row.events) ? row.events.map(mapEvent).filter((item): item is DmCallEvent => Boolean(item)) : [];
  const recordingStatus = row.recording_status === "pending" || row.recording_status === "active" || row.recording_status === "stopped" || row.recording_status === "failed"
    ? row.recording_status
    : "disabled";
  return {
    id,
    conversationId,
    livekitRoomName,
    createdBy,
    callType,
    status,
    startedAt,
    connectedAt: optionalString(row.connected_at),
    endedAt: optionalString(row.ended_at),
    durationSeconds: Math.max(0, numberValue(row.duration_seconds)),
    screenShareUsed: bool(row.screen_share_used),
    recordingStatus,
    createdAt,
    updatedAt,
    participants,
    events,
    invitation: mapInvitation(row.invitation),
    unread: bool(row.unread),
  };
}

function clientOrFailure(): DmCallServiceResult<RpcClient> {
  const status = getSupabaseClientStatus();
  const client = getSupabaseClient();
  if (!status.configured || !client) return failure("DM_CALL_BACKEND_UNAVAILABLE", "The live DM call service is not configured.");
  return { ok: true, data: client as unknown as RpcClient };
}

function friendlyError(error: RpcError | null, fallback: string): ServiceError {
  const raw = error?.message ?? "";
  if (raw.includes("DM_CALL_BLOCKED")) return { code: "DM_CALL_BLOCKED", message: "This call is unavailable because one participant is blocked." };
  if (raw.includes("DM_CALL_ALREADY_ACTIVE")) return { code: "DM_CALL_ALREADY_ACTIVE", message: "A call is already active in this conversation." };
  if (raw.includes("DM_CALL_BUSY")) return { code: "DM_CALL_BUSY", message: "One participant is already in another call." };
  if (raw.includes("DM_CALL_FORBIDDEN") || raw.includes("DM_CALL_TARGET_INVALID")) return { code: "DM_CALL_FORBIDDEN", message: "You no longer have access to calls in this conversation." };
  if (raw.includes("DM_CALL_INVITATION_FORBIDDEN")) return { code: "DM_CALL_INVITATION_FORBIDDEN", message: "This call invitation is no longer available." };
  return { code: error?.code ?? "DM_CALL_FAILED", message: fallback };
}

function emit(call: DmCall): void {
  localListeners.forEach((listener) => listener(call));
}

async function callRpc(name: string, args?: Readonly<Record<string, unknown>>): Promise<DmCallServiceResult<unknown>> {
  const available = clientOrFailure();
  if (!available.ok) return available;
  const { data, error } = await available.data.rpc(name, args);
  if (error) {
    loggingService.logWarn("DM call RPC failed", { operation: name, code: error.code ?? "unknown" }, "voice");
    const resolved = friendlyError(error, "Picom could not update this call.");
    return { ok: false, error: resolved };
  }
  return { ok: true, data };
}

async function snapshotMutation(name: string, args: Readonly<Record<string, unknown>>): Promise<DmCallServiceResult<DmCall>> {
  const result = await callRpc(name, args);
  if (!result.ok) return result;
  const call = mapDmCall(result.data);
  if (!call) return failure("DM_CALL_INVALID_RESPONSE", "The call service returned an incomplete response.");
  emit(call);
  return { ok: true, data: call };
}

export const dmCallService = {
  async listCalls(conversationId?: string, limit = 100): Promise<DmCallServiceResult<DmCall[]>> {
    const result = await callRpc("list_direct_calls", { target_conversation_id: conversationId ?? null, result_limit: Math.max(1, Math.min(limit, 250)) });
    if (!result.ok) return result;
    const calls = Array.isArray(result.data) ? result.data.map(mapDmCall).filter((call): call is DmCall => Boolean(call)) : [];
    return { ok: true, data: calls };
  },

  async getCall(callId: string): Promise<DmCallServiceResult<DmCall>> {
    const result = await callRpc("get_direct_call", { target_call_id: callId });
    if (!result.ok) return result;
    const call = mapDmCall(result.data);
    return call ? { ok: true, data: call } : failure("DM_CALL_NOT_FOUND", "This call is no longer available.");
  },

  async getCurrentActiveCall(): Promise<DmCallServiceResult<DmCall | null>> {
    const result = await callRpc("get_current_active_direct_call");
    if (!result.ok) return result;
    return { ok: true, data: mapDmCall(result.data) };
  },

  async getPendingIncomingCall(currentUserId: string): Promise<DmCallServiceResult<DmCall | null>> {
    const result = await this.listCalls(undefined, 30);
    if (!result.ok) return result;
    const call = result.data.find((item) => item.status === "ringing" && item.createdBy !== currentUserId
      && item.invitation?.inviteeId === currentUserId && item.invitation.status === "ringing"
      && Date.parse(item.invitation.expiresAt) > Date.now()) ?? null;
    return { ok: true, data: call };
  },

  startCall(conversationId: string, targetUserId: string, callType: DmCallType): Promise<DmCallServiceResult<DmCall>> {
    return snapshotMutation("start_direct_call", { target_conversation_id: conversationId, target_user_id: targetUserId, target_call_type: callType });
  },

  respond(callId: string, response: "accepted" | "declined" | "busy"): Promise<DmCallServiceResult<DmCall>> {
    return snapshotMutation("respond_direct_call", { target_call_id: callId, target_response: response });
  },

  updateParticipant(callId: string, state: Exclude<DmCallParticipantStatus, "invited">, media?: Readonly<{ microphoneEnabled?: boolean; cameraEnabled?: boolean; screenShareEnabled?: boolean }>): Promise<DmCallServiceResult<DmCall>> {
    return snapshotMutation("update_direct_call_participant", {
      target_call_id: callId,
      target_state: state,
      target_microphone_enabled: media?.microphoneEnabled ?? null,
      target_camera_enabled: media?.cameraEnabled ?? null,
      target_screen_share_enabled: media?.screenShareEnabled ?? null,
    });
  },

  finishCall(callId: string, status: Extract<DmCallStatus, "declined" | "canceled" | "missed" | "busy" | "failed" | "completed">): Promise<DmCallServiceResult<DmCall>> {
    return snapshotMutation("finish_direct_call", { target_call_id: callId, target_status: status });
  },

  async markRead(callId: string): Promise<DmCallServiceResult<boolean>> {
    const result = await callRpc("mark_direct_call_read", { target_call_id: callId });
    return result.ok ? { ok: true, data: result.data === true } : result;
  },

  async recordQuality(callId: string, sample: DmCallQualitySample): Promise<DmCallServiceResult<boolean>> {
    const result = await callRpc("record_direct_call_quality", {
      target_call_id: callId,
      target_quality: sample.quality,
      target_reconnect_count: sample.reconnectCount,
      target_ping_ms: sample.pingMs ?? null,
      target_jitter_ms: sample.jitterMs ?? null,
      target_packet_loss_percent: sample.packetLossPercent ?? null,
      target_upload_bitrate_kbps: sample.uploadBitrateKbps ?? null,
      target_download_bitrate_kbps: sample.downloadBitrateKbps ?? null,
      target_audio_codec: sample.audioCodec ?? null,
      target_video_codec: sample.videoCodec ?? null,
      target_connection_type: sample.connectionType ?? null,
      target_livekit_region: sample.livekitRegion ?? null,
    });
    return result.ok ? { ok: true, data: result.data === true } : result;
  },

  async recordDeviceEvent(callId: string, deviceKind: "microphone" | "speaker" | "camera" | "screen_share", eventType: "selected" | "enabled" | "disabled" | "muted" | "unmuted" | "failed" | "recovered" | "connected"): Promise<DmCallServiceResult<boolean>> {
    const result = await callRpc("record_direct_call_device_event", { target_call_id: callId, target_device_kind: deviceKind, target_event_type: eventType, target_device_id_hash: null, target_device_label: null });
    if (!result.ok) return result;
    return { ok: true, data: result.data === true };
  },

  subscribeLocal(listener: CallListener): () => void {
    localListeners.add(listener);
    return () => localListeners.delete(listener);
  },

  subscribeRealtime(currentUserId: string, onChanged: (callId?: string) => void): () => void {
    const client = getSupabaseClient();
    if (!client || !currentUserId) return () => undefined;
    let timer: number | null = null;
    const schedule = (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      const row = Object.keys(payload.new ?? {}).length ? payload.new : payload.old;
      const callId = optionalString(row?.call_id) ?? optionalString(row?.id);
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => { timer = null; onChanged(callId); }, 80);
    };
    const channel: RealtimeChannel = client.channel(`dm-call-information:${currentUserId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_calls" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_call_participants" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "dm_call_invitations" }, schedule)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_call_events" }, schedule)
      .subscribe();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      void client.removeChannel(channel);
    };
  },
};
