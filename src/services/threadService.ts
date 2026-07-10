import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ThreadMessage, ThreadRecord, ThreadSummary } from "../types/threads";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
type LocalStore = { threads: ThreadRecord[]; messages: ThreadMessage[]; readAt: Record<string, string> };
const STORAGE_KEY = "picom.threads.v2";
const THREAD_PAGE_LIMIT = 100;

function readLocal(): LocalStore { try { const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<LocalStore>; return { threads: Array.isArray(parsed.threads) ? parsed.threads : [], messages: Array.isArray(parsed.messages) ? parsed.messages : [], readAt: parsed.readAt && typeof parsed.readAt === "object" ? parsed.readAt : {} }; } catch { return { threads: [], messages: [], readAt: {} }; } }
function writeLocal(store: LocalStore): void { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* restricted fallback */ } }
function mapThread(row: { id: string; community_id: string; channel_id: string; parent_message_id: string; name: string; created_by: string; created_at: string; archived_at: string | null }): ThreadRecord { return { id: row.id, communityId: row.community_id, channelId: row.channel_id, parentMessageId: row.parent_message_id, name: row.name, createdBy: row.created_by, createdAt: row.created_at, archivedAt: row.archived_at ?? undefined }; }
function mapMessage(row: { id: string; thread_id: string | null; author_id: string; body: string; created_at: string }, fallbackThreadId: string): ThreadMessage { return { id: row.id, threadId: row.thread_id ?? fallbackThreadId, authorId: row.author_id, body: row.body, createdAt: row.created_at }; }
function mapSummary(value: unknown): ThreadSummary {
  if (!value || typeof value !== "object") return { replyCount: 0, unreadCount: 0 };
  const row = value as Record<string, unknown>;
  return { replyCount: typeof row.replyCount === "number" ? Math.max(0, row.replyCount) : 0, unreadCount: typeof row.unreadCount === "number" ? Math.max(0, row.unreadCount) : 0, lastReplyAt: typeof row.lastReplyAt === "string" ? row.lastReplyAt : undefined };
}
function localSummary(threadId: string): ThreadSummary {
  const store = readLocal(); const messages = store.messages.filter((item) => item.threadId === threadId); const readAt = store.readAt[threadId];
  return { replyCount: messages.length, unreadCount: readAt ? messages.filter((item) => item.createdAt > readAt).length : messages.length, lastReplyAt: messages[messages.length - 1]?.createdAt };
}

export const threadService = {
  async openOrCreate(input: { communityId: string; channelId: string; parentMessageId: string; name: string; createdBy: string; canCreate: boolean }): Promise<Result<ThreadRecord>> {
    const name = input.name.trim().slice(0, 100) || "Message thread";
    if (dataSourceService.getStatus().isMock) { const store = readLocal(); const existing = store.threads.find((item) => item.parentMessageId === input.parentMessageId); if (existing) return { ok: true, data: { ...existing, summary: localSummary(existing.id) } }; if (!input.canCreate) return { ok: false, message: "You can view existing threads but cannot start one in this channel." }; const thread: ThreadRecord = { id: `thread-${crypto.randomUUID()}`, communityId: input.communityId, channelId: input.channelId, parentMessageId: input.parentMessageId, name, createdBy: input.createdBy, createdAt: new Date().toISOString(), summary: { replyCount: 0, unreadCount: 0 } }; writeLocal({ ...store, threads: [...store.threads, thread] }); return { ok: true, data: thread }; }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Threads are unavailable." };
    const auth = await client.auth.getUser(); if (auth.data.user?.id !== input.createdBy) return { ok: false, message: "Sign in again before opening a thread." };
    const result = await client.rpc("open_or_create_thread", { target_community_id: input.communityId, target_channel_id: input.channelId, target_parent_message_id: input.parentMessageId, thread_name: name });
    if (result.error || !result.data || typeof result.data !== "object") return { ok: false, message: "Picom could not open this thread." };
    const row = result.data as unknown as { id: string; community_id: string; channel_id: string; parent_message_id: string; name: string; created_by: string; created_at: string; archived_at: string | null };
    const summary = await this.getSummary(row.id); return { ok: true, data: { ...mapThread(row), summary: summary.ok ? summary.data : undefined } };
  },
  async listMessages(threadId: string): Promise<Result<ThreadMessage[]>> {
    if (dataSourceService.getStatus().isMock) return { ok: true, data: readLocal().messages.filter((item) => item.threadId === threadId).slice(-THREAD_PAGE_LIMIT) };
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Thread messages are unavailable." };
    const { data, error } = await client.from("messages").select("id,thread_id,author_id,body,created_at").eq("thread_id", threadId).is("deleted_at", null).order("created_at", { ascending: false }).limit(THREAD_PAGE_LIMIT);
    return error ? { ok: false, message: "Picom could not load thread messages." } : { ok: true, data: (data ?? []).reverse().map((item) => mapMessage(item, threadId)) };
  },
  async getSummary(threadId: string): Promise<Result<ThreadSummary>> {
    if (dataSourceService.getStatus().isMock) return { ok: true, data: localSummary(threadId) };
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Thread summary is unavailable." };
    const result = await client.rpc("get_thread_summary", { target_thread_id: threadId });
    return result.error ? { ok: false, message: "Could not load thread summary." } : { ok: true, data: mapSummary(result.data) };
  },
  async markRead(threadId: string): Promise<void> {
    if (dataSourceService.getStatus().isMock) { const store = readLocal(); writeLocal({ ...store, readAt: { ...store.readAt, [threadId]: new Date().toISOString() } }); return; }
    const client = getSupabaseClient(); if (client) await client.rpc("mark_thread_read", { target_thread_id: threadId });
  },
  async sendMessage(input: { thread: ThreadRecord; authorId: string; body: string; canSend: boolean }): Promise<Result<ThreadMessage>> {
    const body = input.body.trim().slice(0, 4000); if (!input.canSend) return { ok: false, message: "You do not have permission to reply in this thread." }; if (!body) return { ok: false, message: "Thread reply cannot be empty." }; if (input.thread.archivedAt) return { ok: false, message: "This thread is archived." };
    if (dataSourceService.getStatus().isMock) { const store = readLocal(); const message: ThreadMessage = { id: `thread-message-${crypto.randomUUID()}`, threadId: input.thread.id, authorId: input.authorId, body, createdAt: new Date().toISOString() }; writeLocal({ ...store, messages: [...store.messages, message] }); return { ok: true, data: message }; }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Thread replies are unavailable." }; const auth = await client.auth.getUser(); if (auth.data.user?.id !== input.authorId) return { ok: false, message: "Sign in again before replying." };
    const result = await client.rpc("send_thread_message", { target_thread_id: input.thread.id, message_body: body, target_client_message_id: crypto.randomUUID() });
    if (result.error || !result.data || typeof result.data !== "object") return { ok: false, message: "Picom could not send this thread reply." };
    const row = result.data as unknown as { id: string; thread_id: string | null; author_id: string; body: string; created_at: string };
    return { ok: true, data: mapMessage(row, input.thread.id) };
  },
  subscribe(threadId: string, onMessage: (message: ThreadMessage) => void): () => void {
    if (dataSourceService.getStatus().isMock) return () => undefined;
    const client = getSupabaseClient(); if (!client) return () => undefined;
    const channel: RealtimeChannel = client.channel(`thread:${threadId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` }, (payload) => onMessage(mapMessage(payload.new as { id: string; thread_id: string | null; author_id: string; body: string; created_at: string }, threadId))).subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
