import type { RealtimeChannel } from "@supabase/supabase-js";
import type { BookmarkCollection, BookmarkContentType, BookmarkMetadata, BookmarkRecord, CreateBookmarkInput } from "../types/bookmarks";
import { getSupabaseClient } from "./supabase/supabaseClient";

type BookmarkRow = Readonly<{ id: string; user_id: string; collection_id: string | null; content_type: BookmarkContentType; content_id: string; metadata: BookmarkMetadata | null; created_at: string; updated_at: string }>;
type CollectionRow = Readonly<{ id: string; name: string; created_at: string }>;

function mapBookmark(row: BookmarkRow): BookmarkRecord {
  return { id: row.id, userId: row.user_id, collectionId: row.collection_id ?? undefined, contentType: row.content_type, contentId: row.content_id, metadata: row.metadata ?? {}, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapCollection(row: CollectionRow): BookmarkCollection {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

async function getCurrentUserId(): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

async function listBookmarks(collectionId?: string): Promise<BookmarkRecord[]> {
  const client = getSupabaseClient();
  const userId = await getCurrentUserId();
  if (!client || !userId) return [];
  let query = client.from("bookmarks").select("id,user_id,collection_id,content_type,content_id,metadata,created_at,updated_at").order("created_at", { ascending: false });
  if (collectionId) query = query.eq("collection_id", collectionId);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as unknown as BookmarkRow[]).map(mapBookmark);
}

async function listCollections(): Promise<BookmarkCollection[]> {
  const client = getSupabaseClient();
  const userId = await getCurrentUserId();
  if (!client || !userId) return [];
  const { data, error } = await client.from("bookmark_collections").select("id,name,created_at").order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown as CollectionRow[]).map(mapCollection);
}

async function saveBookmark(input: CreateBookmarkInput): Promise<BookmarkRecord | null> {
  const contentId = input.contentId.trim();
  if (!contentId) return null;
  const client = getSupabaseClient();
  const userId = await getCurrentUserId();
  if (!client || !userId) return null;
  const { data, error } = await client
    .from("bookmarks")
    .upsert({ user_id: userId, content_type: input.contentType, content_id: contentId, collection_id: input.collectionId ?? null, metadata: input.metadata ?? {}, updated_at: new Date().toISOString() }, { onConflict: "user_id,content_type,content_id" })
    .select("id,user_id,collection_id,content_type,content_id,metadata,created_at,updated_at")
    .single();
  return error || !data ? null : mapBookmark(data as unknown as BookmarkRow);
}

async function deleteBookmark(bookmarkId: string): Promise<boolean> {
  const client = getSupabaseClient();
  const userId = await getCurrentUserId();
  if (!client || !userId || !bookmarkId) return false;
  const { error } = await client.from("bookmarks").delete().eq("id", bookmarkId).eq("user_id", userId);
  return !error;
}

async function deleteBookmarkByTarget(contentType: BookmarkContentType, contentId: string): Promise<boolean> {
  const client = getSupabaseClient();
  const userId = await getCurrentUserId();
  if (!client || !userId || !contentId) return false;
  const { error } = await client.from("bookmarks").delete().eq("user_id", userId).eq("content_type", contentType).eq("content_id", contentId);
  return !error;
}

async function createCollection(name: string): Promise<BookmarkCollection | null> {
  const cleanName = name.trim().slice(0, 80);
  const client = getSupabaseClient();
  const userId = await getCurrentUserId();
  if (!client || !userId || !cleanName) return null;
  const { data, error } = await client.from("bookmark_collections").insert({ user_id: userId, name: cleanName }).select("id,name,created_at").single();
  return error || !data ? null : mapCollection(data as unknown as CollectionRow);
}

function subscribe(onChange: () => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => undefined;
  let disposed = false;
  let channel: RealtimeChannel | null = null;
  void getCurrentUserId().then((userId) => {
    if (!userId || disposed) return;
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    channel = client.channel(`bookmarks:${userId}:${id}`).on("postgres_changes", { event: "*", schema: "public", table: "bookmarks", filter: `user_id=eq.${userId}` }, onChange).subscribe();
  });
  return () => { disposed = true; if (channel) void client.removeChannel(channel); };
}

export const bookmarkService = { listBookmarks, listCollections, saveBookmark, deleteBookmark, deleteBookmarkByTarget, createCollection, subscribe };
