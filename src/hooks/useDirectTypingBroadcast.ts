import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { dataSourceService } from "../services/dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "../services/supabase/supabaseClient";
import { mapRealtimeSubscriptionStatus, realtimeChannelNames, type RealtimeConnectionStatus } from "../services/supabase/realtimeService";

type TypingPayload = Readonly<{ userId: string; displayName: string; isTyping: boolean; sentAt: number }>;
type TypingUser = Readonly<{ displayName: string; expiresAt: number; sentAt: number }>;
type Input = Readonly<{ enabled: boolean; conversationId: string; currentUserId: string; displayName: string }>;
const mockRooms = new Map<string, Set<(payload: TypingPayload) => void>>();
const TYPING_TTL_MS = 4200;

export function useDirectTypingBroadcast(input: Input) {
  const [users, setUsers] = useState<Record<string, TypingUser>>({});
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>("idle");
  const channelRef = useRef<RealtimeChannel | null>(null); const subscribedRef = useRef(false); const lastSentAtRef = useRef(0);
  const receive = useCallback((payload: TypingPayload) => { if (payload.userId === input.currentUserId) return; setUsers((current) => { const existing = current[payload.userId]; if (existing && existing.sentAt > payload.sentAt) return current; const next = { ...current }; if (!payload.isTyping) delete next[payload.userId]; else next[payload.userId] = { displayName: payload.displayName, expiresAt: Date.now() + TYPING_TTL_MS, sentAt: payload.sentAt }; return next; }); }, [input.currentUserId]);

  useEffect(() => {
    setUsers({}); setConnectionStatus("idle"); subscribedRef.current = false; channelRef.current = null; lastSentAtRef.current = 0;
    if (!input.enabled || !input.conversationId) return;
    const cleanupTimer = window.setInterval(() => setUsers((current) => Object.fromEntries(Object.entries(current).filter(([, user]) => user.expiresAt > Date.now()))), 1200);
    if (dataSourceService.getStatus().isMock) {
      const listeners = mockRooms.get(input.conversationId) ?? new Set<(payload: TypingPayload) => void>(); listeners.add(receive); mockRooms.set(input.conversationId, listeners); setConnectionStatus("connected"); subscribedRef.current = true;
      return () => { window.clearInterval(cleanupTimer); listeners.delete(receive); if (!listeners.size) mockRooms.delete(input.conversationId); };
    }
    const status = getSupabaseClientStatus(); const client = getSupabaseClient(); if (!status.configured || !client) { window.clearInterval(cleanupTimer); setConnectionStatus("disconnected"); return; }
    let connected = false; setConnectionStatus("connecting");
    const channel = client.channel(realtimeChannelNames.directTyping(input.conversationId), { config: { private: true, broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, ({ payload }) => { const value = payload as Partial<TypingPayload>; if (typeof value.userId === "string" && typeof value.displayName === "string" && typeof value.isTyping === "boolean" && typeof value.sentAt === "number") receive(value as TypingPayload); })
      .subscribe((value) => { const next = mapRealtimeSubscriptionStatus(value, connected); if (next === "connected") { connected = true; subscribedRef.current = true; } if (next) setConnectionStatus(next); });
    channelRef.current = channel;
    return () => { window.clearInterval(cleanupTimer); if (subscribedRef.current) void channel.send({ type: "broadcast", event: "typing", payload: { userId: input.currentUserId, displayName: input.displayName, isTyping: false, sentAt: Date.now() } satisfies TypingPayload }); subscribedRef.current = false; channelRef.current = null; void client.removeChannel(channel); };
  }, [input.conversationId, input.currentUserId, input.displayName, input.enabled, receive]);

  const send = useCallback((isTyping: boolean) => {
    const sentAt = Date.now(); if (isTyping && sentAt - lastSentAtRef.current < 1200) return; lastSentAtRef.current = isTyping ? sentAt : 0;
    const payload = { userId: input.currentUserId, displayName: input.displayName, isTyping, sentAt } satisfies TypingPayload;
    if (dataSourceService.getStatus().isMock) { for (const listener of mockRooms.get(input.conversationId) ?? []) listener(payload); return; }
    if (channelRef.current && subscribedRef.current) void channelRef.current.send({ type: "broadcast", event: "typing", payload });
  }, [input.conversationId, input.currentUserId, input.displayName]);

  return { typingNames: useMemo(() => Object.values(users).map((user) => user.displayName).sort(), [users]), connectionStatus, sendTypingStart: () => send(true), sendTypingStop: () => send(false) };
}
