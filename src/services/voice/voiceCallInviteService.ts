import type { RealtimeChannel } from "@supabase/supabase-js";
import { getApiCompatibilityRequestHeaders } from "../../config/apiCompatibility";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import { loggingService } from "../loggingService";
import { dmCallService } from "../directMessages/dmCallService";
import type { DmCall, DmCallType } from "../../types/dmCalls";

// Real-time voice-call signaling ("ring someone into a voice room") built on
// Supabase Realtime broadcast, so it needs no schema/migration and works as soon
// as both users are online. Each user listens on their own inbox channel
// `voice-call:<userId>`; to ring someone you broadcast an `invite` to their inbox,
// and they reply with a `response` (accepted/declined) to yours. Invites expire
// after INVITE_TTL_MS so a missed call clears itself on both sides.
//
// Transport is intentionally isolated behind this service so the signaling can be
// swapped for an RLS-backed table later without touching the UI. Invites are
// authorized via the voice-call-authorize Edge Function before broadcast.

export type VoiceCallCommunityRoom = Readonly<{
  kind: "community";
  communityId: string;
  communityName: string;
  channelId: string;
  channelName: string;
}>;

export type VoiceCallDirectRoom = Readonly<{
  kind: "direct";
  conversationId: string;
  callId: string;
  callType: DmCallType;
  startedAt: string;
  livekitRoomName: string;
  peerName: string;
}>;

export type VoiceCallRoom = VoiceCallCommunityRoom | VoiceCallDirectRoom;

export type VoiceCallParty = Readonly<{
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  avatarPath?: string;
  avatarUpdatedAt?: string;
}>;

export type IncomingVoiceCall = Readonly<{
  inviteId: string;
  caller: VoiceCallParty;
  room: VoiceCallRoom;
  createdAt: string;
  expiresAt: string;
}>;

export type OutgoingVoiceCallStatus = "ringing" | "accepted" | "declined" | "canceled" | "timeout" | "failed";

export type OutgoingVoiceCall = Readonly<{
  inviteId: string;
  target: VoiceCallParty;
  room: VoiceCallRoom;
  status: OutgoingVoiceCallStatus;
  createdAt: string;
  expiresAt: string;
  failureMessage?: string;
}>;

export const VOICE_CALL_INVITE_TTL_MS = 30_000;
const INBOX_PREFIX = "voice-call:";
const RESOLVED_STATUS_CLEAR_MS = 4_000;

type IncomingListener = (call: IncomingVoiceCall | null) => void;
type OutgoingListener = (call: OutgoingVoiceCall | null) => void;

let self: VoiceCallParty | null = null;
let inboxChannel: RealtimeChannel | null = null;
const outboundChannels = new Map<string, RealtimeChannel>();

let incoming: IncomingVoiceCall | null = null;
let outgoing: OutgoingVoiceCall | null = null;
const incomingListeners = new Set<IncomingListener>();
const outgoingListeners = new Set<OutgoingListener>();
let outgoingTimer: number | null = null;
let incomingTimer: number | null = null;
let resolvedClearTimer: number | null = null;
let callRealtimeCleanup: (() => void) | null = null;

function inboxChannelName(userId: string): string {
  return `${INBOX_PREFIX}${userId}`;
}

function setIncoming(call: IncomingVoiceCall | null): void {
  incoming = call;
  incomingListeners.forEach((listener) => listener(incoming));
}

function setOutgoing(call: OutgoingVoiceCall | null): void {
  outgoing = call;
  outgoingListeners.forEach((listener) => listener(outgoing));
}

function isParty(value: unknown): value is VoiceCallParty {
  return typeof value === "object" && value !== null
    && typeof (value as { id?: unknown }).id === "string"
    && typeof (value as { name?: unknown }).name === "string";
}

function isRoom(value: unknown): value is VoiceCallRoom {
  const record = value as Record<string, unknown> | null;
  if (typeof record !== "object" || record === null) return false;
  if (record.kind === "community") {
    return typeof record.communityId === "string" && typeof record.channelId === "string"
      && typeof record.communityName === "string" && typeof record.channelName === "string";
  }
  if (record.kind === "direct") {
    return typeof record.conversationId === "string" && typeof record.callId === "string"
      && (record.callType === "voice" || record.callType === "video")
      && typeof record.startedAt === "string" && typeof record.livekitRoomName === "string"
      && typeof record.peerName === "string";
  }
  return false;
}

function parseInvite(payload: unknown): IncomingVoiceCall | null {
  const record = payload as Record<string, unknown> | null;
  if (typeof record !== "object" || record === null) return null;
  if (typeof record.inviteId !== "string" || typeof record.expiresAt !== "string") return null;
  if (!isParty(record.caller) || !isRoom(record.room)) return null;
  return {
    inviteId: record.inviteId,
    caller: { id: record.caller.id, name: record.caller.name.slice(0, 120), avatarUrl: typeof record.caller.avatarUrl === "string" ? record.caller.avatarUrl : undefined },
    room: record.room,
    createdAt: new Date().toISOString(),
    expiresAt: record.expiresAt,
  };
}

function clearOutgoingTimer(): void {
  if (outgoingTimer !== null) { window.clearTimeout(outgoingTimer); outgoingTimer = null; }
}

function scheduleResolvedClear(inviteId: string): void {
  if (resolvedClearTimer !== null) window.clearTimeout(resolvedClearTimer);
  resolvedClearTimer = window.setTimeout(() => {
    if (outgoing?.inviteId === inviteId) setOutgoing(null);
  }, RESOLVED_STATUS_CLEAR_MS);
}

function persistentIncoming(call: DmCall): IncomingVoiceCall | null {
  if (!self || call.createdBy === self.id || call.status !== "ringing" || call.invitation?.inviteeId !== self.id || call.invitation.status !== "ringing") return null;
  const caller = call.participants.find((participant) => participant.userId === call.createdBy);
  if (!caller || Date.parse(call.invitation.expiresAt) <= Date.now()) return null;
  return {
    inviteId: call.id,
    caller: { id: caller.userId, name: caller.displayName, avatarUrl: caller.avatarUrl },
    room: { kind: "direct", conversationId: call.conversationId, callId: call.id, callType: call.callType, startedAt: call.startedAt, livekitRoomName: call.livekitRoomName, peerName: caller.displayName },
    createdAt: call.createdAt,
    expiresAt: call.invitation.expiresAt,
  };
}

async function refreshPersistentIncoming(): Promise<void> {
  if (!self) return;
  const result = await dmCallService.getPendingIncomingCall(self.id);
  if (!result.ok) return;
  const call = result.data ? persistentIncoming(result.data) : null;
  if (call && incoming?.inviteId !== call.inviteId) {
    setIncoming(call);
    if (incomingTimer !== null) window.clearTimeout(incomingTimer);
    incomingTimer = window.setTimeout(() => {
      if (incoming?.inviteId === call.inviteId) setIncoming(null);
    }, Math.max(0, Date.parse(call.expiresAt) - Date.now()));
  } else if (!call && incoming?.room.kind === "direct") {
    setIncoming(null);
  }
}

async function handleIncomingInvite(payload: unknown): Promise<void> {
  const call = parseInvite(payload);
  if (!call || !self || call.caller.id === self.id) return;
  if (Date.parse(call.expiresAt) <= Date.now()) return;
  if (incoming?.inviteId === call.inviteId) return;
  if (call.room.kind === "direct") {
    const verified = await dmCallService.getCall(call.room.callId);
    if (!verified.ok || verified.data.conversationId !== call.room.conversationId || verified.data.createdBy !== call.caller.id || !persistentIncoming(verified.data)) return;
  }
  setIncoming(call);
  if (incomingTimer !== null) window.clearTimeout(incomingTimer);
  const remaining = Math.max(0, Date.parse(call.expiresAt) - Date.now());
  incomingTimer = window.setTimeout(() => {
    if (incoming?.inviteId === call.inviteId) setIncoming(null);
  }, remaining);
}

function handleResponse(payload: unknown): void {
  const record = payload as Record<string, unknown> | null;
  if (typeof record !== "object" || record === null) return;
  const inviteId = record.inviteId;
  const status = record.status;
  if (typeof inviteId !== "string" || (status !== "accepted" && status !== "declined")) return;
  if (!outgoing || outgoing.inviteId !== inviteId) return;
  clearOutgoingTimer();
  setOutgoing({ ...outgoing, status });
  if (outgoing.room.kind === "direct") {
    if (status === "declined") void dmCallService.finishCall(outgoing.room.callId, "declined");
    else void dmCallService.getCall(outgoing.room.callId);
  }
  scheduleResolvedClear(inviteId);
}

function handleCancel(payload: unknown): void {
  const record = payload as Record<string, unknown> | null;
  const inviteId = record?.inviteId;
  if (typeof inviteId !== "string") return;
  if (incoming?.inviteId === inviteId) setIncoming(null);
}

function ensureOutbound(userId: string): Promise<RealtimeChannel | null> {
  const existing = outboundChannels.get(userId);
  if (existing) return Promise.resolve(existing);
  const client = getSupabaseClient();
  if (!client) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = client.channel(inboxChannelName(userId), { config: { broadcast: { self: false } } });
    let settled = false;
    channel.subscribe((status) => {
      if (settled) return;
      if (status === "SUBSCRIBED") {
        settled = true;
        outboundChannels.set(userId, channel);
        resolve(channel);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        settled = true;
        try { client.removeChannel(channel); } catch { /* channel already torn down */ }
        resolve(null);
      }
    });
  });
}

export const voiceCallInviteService = {
  configure(party: VoiceCallParty): void {
    self = party;
  },

  start(): void {
    const client = getSupabaseClient();
    if (!client || !self || inboxChannel) return;
    const channel = client.channel(inboxChannelName(self.id), { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "invite" }, ({ payload }) => { void handleIncomingInvite(payload); });
    channel.on("broadcast", { event: "response" }, ({ payload }) => handleResponse(payload));
    channel.on("broadcast", { event: "cancel" }, ({ payload }) => handleCancel(payload));
    channel.subscribe();
    inboxChannel = channel;
    callRealtimeCleanup?.();
    callRealtimeCleanup = dmCallService.subscribeRealtime(self.id, () => { void refreshPersistentIncoming(); });
    void refreshPersistentIncoming();
  },

  stop(): void {
    const client = getSupabaseClient();
    if (client) {
      if (inboxChannel) { try { client.removeChannel(inboxChannel); } catch { /* already removed */ } }
      for (const channel of outboundChannels.values()) { try { client.removeChannel(channel); } catch { /* already removed */ } }
    }
    inboxChannel = null;
    callRealtimeCleanup?.();
    callRealtimeCleanup = null;
    outboundChannels.clear();
    clearOutgoingTimer();
    if (incomingTimer !== null) { window.clearTimeout(incomingTimer); incomingTimer = null; }
    setIncoming(null);
    setOutgoing(null);
  },

  getIncoming(): IncomingVoiceCall | null { return incoming; },
  getOutgoing(): OutgoingVoiceCall | null { return outgoing; },

  onIncoming(listener: IncomingListener): () => void {
    incomingListeners.add(listener);
    return () => incomingListeners.delete(listener);
  },

  onOutgoing(listener: OutgoingListener): () => void {
    outgoingListeners.add(listener);
    return () => outgoingListeners.delete(listener);
  },

  async invite(target: VoiceCallParty, room: VoiceCallRoom): Promise<OutgoingVoiceCall | null> {
    if (!self || target.id === self.id) return null;

    const fail = (failureMessage: string): OutgoingVoiceCall => {
      const failed: OutgoingVoiceCall = {
        inviteId: crypto.randomUUID(),
        target,
        room,
        status: "failed",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + VOICE_CALL_INVITE_TTL_MS).toISOString(),
        failureMessage,
      };
      setOutgoing(failed);
      scheduleResolvedClear(failed.inviteId);
      loggingService.logWarn("Voice invite failed", { message: failureMessage }, "voice");
      return failed;
    };

    const status = getSupabaseClientStatus();
    const supabase = getSupabaseClient();
    if (status.configured && supabase) {
      const authorizeBody = room.kind === "community"
        ? { kind: "community" as const, communityId: room.communityId, channelId: room.channelId, targetUserId: target.id }
        : { kind: "direct" as const, conversationId: room.conversationId, callId: room.callId, targetUserId: target.id };
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; code?: string; message?: string }>("voice-call-authorize", {
        headers: getApiCompatibilityRequestHeaders(),
        body: authorizeBody,
      });
      if (error || !data?.ok) {
        let message = "You cannot invite this person to voice.";
        if (error && typeof error === "object" && "context" in error && (error as { context?: unknown }).context instanceof Response) {
          const response = (error as { context: Response }).context;
          if (response.status === 404) {
            message = "Voice invite service is not deployed. Deploy voice-call-authorize.";
          } else {
            const payload = await response.clone().json().catch(() => null) as { message?: string; code?: string } | null;
            if (typeof payload?.message === "string" && payload.message.trim()) message = payload.message.trim().slice(0, 200);
          }
        } else if (typeof data?.message === "string" && data.message.trim()) {
          message = data.message.trim().slice(0, 200);
        } else if (error?.message?.includes("Failed to send") || error?.message?.includes("fetch")) {
          message = "Could not reach the voice invite service. Check your connection.";
        }
        return fail(message);
      }
    }

    const channel = await ensureOutbound(target.id);
    if (!channel) {
      return fail("Realtime could not connect to their inbox. Both users need to be online.");
    }
    const inviteId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = new Date(now + VOICE_CALL_INVITE_TTL_MS).toISOString();
    const call: OutgoingVoiceCall = { inviteId, target, room, status: "ringing", createdAt: new Date(now).toISOString(), expiresAt };
    const result = await channel.send({ type: "broadcast", event: "invite", payload: { inviteId, caller: self, room, expiresAt } });
    if (result !== "ok") {
      return fail("Invite broadcast failed. Ask them to open Picom and try again.");
    }
    setOutgoing(call);
    clearOutgoingTimer();
    outgoingTimer = window.setTimeout(() => {
      if (outgoing?.inviteId === inviteId && outgoing.status === "ringing") void voiceCallInviteService.cancel("timeout");
    }, VOICE_CALL_INVITE_TTL_MS);
    return call;
  },

  async accept(): Promise<IncomingVoiceCall | null> {
    const call = incoming;
    if (!call || !self) return null;
    const channel = await ensureOutbound(call.caller.id);
    if (call.room.kind === "direct") {
      const response = await dmCallService.respond(call.room.callId, "accepted");
      if (!response.ok) return null;
    }
    await channel?.send({ type: "broadcast", event: "response", payload: { inviteId: call.inviteId, status: "accepted", responder: self } });
    if (incomingTimer !== null) { window.clearTimeout(incomingTimer); incomingTimer = null; }
    setIncoming(null);
    return call;
  },

  async decline(): Promise<void> {
    const call = incoming;
    if (!call || !self) { setIncoming(null); return; }
    const channel = await ensureOutbound(call.caller.id);
    if (call.room.kind === "direct") void dmCallService.respond(call.room.callId, "declined");
    await channel?.send({ type: "broadcast", event: "response", payload: { inviteId: call.inviteId, status: "declined", responder: self } });
    if (incomingTimer !== null) { window.clearTimeout(incomingTimer); incomingTimer = null; }
    setIncoming(null);
  },

  async cancel(reason: Extract<OutgoingVoiceCallStatus, "canceled" | "timeout"> = "canceled"): Promise<void> {
    const call = outgoing;
    if (!call) return;
    clearOutgoingTimer();
    const channel = await ensureOutbound(call.target.id);
    await channel?.send({ type: "broadcast", event: "cancel", payload: { inviteId: call.inviteId } });
    if (call.room.kind === "direct") void dmCallService.finishCall(call.room.callId, reason === "timeout" ? "missed" : "canceled");
    setOutgoing({ ...call, status: reason });
    scheduleResolvedClear(call.inviteId);
  },

  dismissOutgoing(): void {
    clearOutgoingTimer();
    setOutgoing(null);
  },
};
