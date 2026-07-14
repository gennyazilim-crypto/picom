import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase/supabaseClient";

// Real-time voice-call signaling ("ring someone into a voice room") built on
// Supabase Realtime broadcast, so it needs no schema/migration and works as soon
// as both users are online. Each user listens on their own inbox channel
// `voice-call:<userId>`; to ring someone you broadcast an `invite` to their inbox,
// and they reply with a `response` (accepted/declined) to yours. Invites expire
// after INVITE_TTL_MS so a missed call clears itself on both sides.
//
// Transport is intentionally isolated behind this service so the signaling can be
// swapped for an RLS-backed table later without touching the UI. Server-side abuse
// hardening (only community members / friends may ring a user) is a follow-up.

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
  peerName: string;
}>;

export type VoiceCallRoom = VoiceCallCommunityRoom | VoiceCallDirectRoom;

export type VoiceCallParty = Readonly<{
  id: string;
  name: string;
  avatarUrl?: string;
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
    return typeof record.conversationId === "string" && typeof record.peerName === "string";
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

function handleIncomingInvite(payload: unknown): void {
  const call = parseInvite(payload);
  if (!call || !self || call.caller.id === self.id) return;
  if (Date.parse(call.expiresAt) <= Date.now()) return;
  if (incoming?.inviteId === call.inviteId) return;
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
    channel.on("broadcast", { event: "invite" }, ({ payload }) => handleIncomingInvite(payload));
    channel.on("broadcast", { event: "response" }, ({ payload }) => handleResponse(payload));
    channel.on("broadcast", { event: "cancel" }, ({ payload }) => handleCancel(payload));
    channel.subscribe();
    inboxChannel = channel;
  },

  stop(): void {
    const client = getSupabaseClient();
    if (client) {
      if (inboxChannel) { try { client.removeChannel(inboxChannel); } catch { /* already removed */ } }
      for (const channel of outboundChannels.values()) { try { client.removeChannel(channel); } catch { /* already removed */ } }
    }
    inboxChannel = null;
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
    const channel = await ensureOutbound(target.id);
    if (!channel) return null;
    const inviteId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = new Date(now + VOICE_CALL_INVITE_TTL_MS).toISOString();
    const call: OutgoingVoiceCall = { inviteId, target, room, status: "ringing", createdAt: new Date(now).toISOString(), expiresAt };
    const result = await channel.send({ type: "broadcast", event: "invite", payload: { inviteId, caller: self, room, expiresAt } });
    if (result !== "ok") {
      const failed: OutgoingVoiceCall = { ...call, status: "failed" };
      setOutgoing(failed);
      scheduleResolvedClear(inviteId);
      return failed;
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
    await channel?.send({ type: "broadcast", event: "response", payload: { inviteId: call.inviteId, status: "accepted", responder: self } });
    if (incomingTimer !== null) { window.clearTimeout(incomingTimer); incomingTimer = null; }
    setIncoming(null);
    return call;
  },

  async decline(): Promise<void> {
    const call = incoming;
    if (!call || !self) { setIncoming(null); return; }
    const channel = await ensureOutbound(call.caller.id);
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
    setOutgoing({ ...call, status: reason });
    scheduleResolvedClear(call.inviteId);
  },

  dismissOutgoing(): void {
    clearOutgoingTimer();
    setOutgoing(null);
  },
};
