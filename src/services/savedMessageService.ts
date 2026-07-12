import type { RealtimeChannel } from "@supabase/supabase-js";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.savedMessages.v3";
export type SavedMessageRecord = Readonly<{ id: string; messageId: string; communityId: string; channelId: string; authorId: string; preview: string; messageCreatedAt: string; createdAt: string }>;
export type SaveMessageContext = Readonly<{ communityId: string; channelId: string; authorId: string; preview: string; messageCreatedAt: string }>;

function read(): SavedMessageRecord[] { try { const raw = window.localStorage.getItem(STORAGE_KEY); const value = raw ? JSON.parse(raw) : []; return Array.isArray(value) ? value as SavedMessageRecord[] : []; } catch { return []; } }
function write(items: SavedMessageRecord[]): void { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* safe fallback */ } }
function sort(items: SavedMessageRecord[]): SavedMessageRecord[] { return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export async function saveMessage(messageId: string, context?: SaveMessageContext): Promise<boolean> {
  if (!messageId.trim()) return false;
  if (dataSourceService.getStatus().isMock) { if (!context) return false; const items = read(); if (!items.some((item) => item.messageId === messageId)) write([{ id: `saved-${messageId}`, messageId, ...context, createdAt: new Date().toISOString() }, ...items]); return true; }
  const client = getSupabaseClient(); if (!client) return false; const { data } = await client.auth.getUser(); if (!data.user) return false;
  const { error } = await client.from("saved_messages").upsert({ user_id: data.user.id, message_id: messageId }, { onConflict: "user_id,message_id" });
  if (!error && context) { const items = read().filter((item) => item.messageId !== messageId); write([{ id: `pending-saved-${messageId}`, messageId, ...context, createdAt: new Date().toISOString() }, ...items]); }
  return !error;
}

export async function unsaveMessage(messageId: string): Promise<boolean> {
  if (dataSourceService.getStatus().isMock) { write(read().filter((item) => item.messageId !== messageId)); return true; }
  const client = getSupabaseClient(); if (!client) return false; const { data } = await client.auth.getUser(); if (!data.user) return false;
  const { error } = await client.from("saved_messages").delete().eq("user_id", data.user.id).eq("message_id", messageId);
  if (!error) write(read().filter((item) => item.messageId !== messageId));
  return !error;
}

export async function getSavedMessages(): Promise<SavedMessageRecord[]> {
  if (dataSourceService.getStatus().isMock) return listSavedMessages();
  const client = getSupabaseClient(); if (!client) { write([]); return []; }
  const result = await client.rpc("list_accessible_saved_messages", { result_limit: 200 });
  if (result.error) return [];
  const items: SavedMessageRecord[] = (result.data ?? []).map((row) => ({ id: row.id, messageId: row.message_id, communityId: row.community_id, channelId: row.channel_id, authorId: row.author_id, preview: row.preview, messageCreatedAt: row.message_created_at, createdAt: row.created_at }));
  write(sort(items));
  return sort(items);
}

export function listSavedMessages(): SavedMessageRecord[] { return sort(read()); }
export function isMessageSaved(messageId: string): boolean { return read().some((item) => item.messageId === messageId); }
export function subscribe(onChange: () => void): () => void {
  if (dataSourceService.getStatus().isMock) return () => undefined;
  const client = getSupabaseClient(); if (!client) return () => undefined;
  const subscriptionId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channel: RealtimeChannel = client
    .channel(`saved-messages:current-user:${subscriptionId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "saved_messages" }, onChange)
    .subscribe();
  return () => { void client.removeChannel(channel); };
}

export const savedMessageService = { saveMessage, unsaveMessage, getSavedMessages, listSavedMessages, isMessageSaved, subscribe };
