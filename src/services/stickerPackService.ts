import type { CommunitySticker, CommunityStickerPack } from "../types/stickers";
import { dataSourceService } from "./dataSourceService";
import { fileService } from "./fileService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.communityStickerPacks.v1";
const STICKER_BUCKET = "community-stickers";
const MAX_STICKER_BYTES = 2 * 1024 * 1024;
type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function readAll(): Record<string, CommunityStickerPack[]> {
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, CommunityStickerPack[]>; }
  catch { return {}; }
}
function writeAll(value: Record<string, CommunityStickerPack[]>): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
  catch { /* restricted fallback */ }
}
function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32);
}
function extensionForMime(mime: string): string | null {
  return mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : null;
}
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("invalid sticker"));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type StickerRow = { id: string; pack_id: string | null; community_id: string; name: string; title: string; image_url: string; storage_path: string | null; created_by: string; created_at: string; moderation_status: string; deleted_at: string | null };
type PackRow = { id: string; community_id: string; name: string; description: string; created_by: string; created_at: string; moderation_status: string; deleted_at: string | null };

async function mapSticker(row: StickerRow): Promise<CommunitySticker> {
  const client = getSupabaseClient();
  const signed = row.storage_path && client ? await client.storage.from(STICKER_BUCKET).createSignedUrl(row.storage_path, 60 * 60) : null;
  return { id: row.id, packId: row.pack_id ?? undefined, communityId: row.community_id, name: row.name, title: row.title, imageUrl: signed?.data?.signedUrl ?? row.image_url, storagePath: row.storage_path ?? undefined, createdBy: row.created_by, createdAt: row.created_at, moderationStatus: row.moderation_status === "disabled" ? "disabled" : "active" };
}

export const stickerPackService = {
  listLocal(communityId: string): CommunityStickerPack[] {
    return (readAll()[communityId] ?? []).filter((pack) => pack.moderationStatus === "active").map((pack) => ({ ...pack, stickers: pack.stickers.filter((sticker) => sticker.moderationStatus !== "disabled") }));
  },
  async list(communityId: string): Promise<Result<CommunityStickerPack[]>> {
    if (dataSourceService.getStatus().isMock) return { ok: true, data: this.listLocal(communityId) };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Sticker packs are unavailable." };
    const [packsResult, stickersResult] = await Promise.all([
      client.from("community_sticker_packs").select("id,community_id,name,description,created_by,created_at,moderation_status,deleted_at").eq("community_id", communityId).is("deleted_at", null).order("created_at"),
      client.from("community_stickers").select("id,pack_id,community_id,name,title,image_url,storage_path,created_by,created_at,moderation_status,deleted_at").eq("community_id", communityId).is("deleted_at", null).order("created_at"),
    ]);
    if (packsResult.error || stickersResult.error) return { ok: false, message: "Could not load community sticker packs." };
    const stickers = await Promise.all((stickersResult.data ?? []).map(mapSticker));
    return { ok: true, data: (packsResult.data ?? []).map((pack: PackRow) => ({ id: pack.id, communityId: pack.community_id, name: pack.name, description: pack.description, ownerId: pack.created_by, createdAt: pack.created_at, moderationStatus: pack.moderation_status === "disabled" ? "disabled" : "active", stickers: stickers.filter((sticker) => sticker.packId === pack.id) })) };
  },
  async createPack(input: { communityId: string; name: string; description: string; ownerId: string; canManage: boolean }): Promise<Result<CommunityStickerPack>> {
    if (!input.canManage) return { ok: false, message: "You do not have permission to manage sticker packs." };
    const name = normalizeName(input.name);
    if (name.length < 2) return { ok: false, message: "Use 2-32 letters, numbers, or underscores for the pack name." };
    const description = input.description.trim().slice(0, 240);
    if (dataSourceService.getStatus().isMock) {
      const all = readAll(); const current = all[input.communityId] ?? [];
      if (current.some((pack) => pack.name === name)) return { ok: false, message: "Pack names must be unique in this community." };
      const pack: CommunityStickerPack = { id: `sticker-pack-${crypto.randomUUID()}`, communityId: input.communityId, name, description, ownerId: input.ownerId, createdAt: new Date().toISOString(), moderationStatus: "active", stickers: [] };
      all[input.communityId] = [...current, pack]; writeAll(all); return { ok: true, data: pack };
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Sticker pack storage is unavailable." };
    const auth = await client.auth.getUser();
    if (auth.data.user?.id !== input.ownerId) return { ok: false, message: "Sign in again before creating a sticker pack." };
    const result = await client.from("community_sticker_packs").insert({ community_id: input.communityId, name, description, created_by: input.ownerId }).select("id,community_id,name,description,created_by,created_at,moderation_status,deleted_at").single();
    if (result.error) return { ok: false, message: result.error.code === "23505" ? "Pack names must be unique in this community." : "Could not create sticker pack." };
    return { ok: true, data: { id: result.data.id, communityId: result.data.community_id, name: result.data.name, description: result.data.description, ownerId: result.data.created_by, createdAt: result.data.created_at, moderationStatus: "active", stickers: [] } };
  },
  async addSticker(input: { communityId: string; packId: string; name: string; title: string; file: File; createdBy: string; canManage: boolean }): Promise<Result<CommunitySticker>> {
    if (!input.canManage) return { ok: false, message: "You do not have permission to upload stickers." };
    const name = normalizeName(input.name); const title = input.title.trim().slice(0, 80);
    if (name.length < 2 || !title) return { ok: false, message: "Sticker name and title are required." };
    const basic = fileService.validate(input.file); if (!basic.ok) return { ok: false, message: basic.reason };
    if (input.file.size > MAX_STICKER_BYTES) return { ok: false, message: "Sticker images must be 2 MB or smaller." };
    const content = await fileService.validateContent(input.file); if (!content.ok) return { ok: false, message: content.reason };
    const extension = extensionForMime(input.file.type); if (!extension) return { ok: false, message: "Unsupported sticker image type." };
    if (dataSourceService.getStatus().isMock) {
      const all = readAll(); const packs = all[input.communityId] ?? []; const pack = packs.find((candidate) => candidate.id === input.packId);
      if (!pack) return { ok: false, message: "Sticker pack not found." };
      if (pack.stickers.some((sticker) => sticker.name === name)) return { ok: false, message: "Sticker names must be unique in this community." };
      const sticker: CommunitySticker = { id: `sticker-${crypto.randomUUID()}`, packId: input.packId, communityId: input.communityId, name, title, imageUrl: await fileToDataUrl(input.file), createdBy: input.createdBy, createdAt: new Date().toISOString(), moderationStatus: "active" };
      all[input.communityId] = packs.map((candidate) => candidate.id === input.packId ? { ...candidate, stickers: [...candidate.stickers, sticker] } : candidate); writeAll(all); return { ok: true, data: sticker };
    }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Sticker storage is unavailable." };
    const auth = await client.auth.getUser(); if (auth.data.user?.id !== input.createdBy) return { ok: false, message: "Sign in again before uploading a sticker." };
    const stickerId = crypto.randomUUID(); const storagePath = `communities/${input.communityId}/sticker-packs/${input.packId}/${stickerId}.${extension}`;
    const upload = await client.storage.from(STICKER_BUCKET).upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
    if (upload.error) return { ok: false, message: "Could not upload sticker." };
    const inserted = await client.from("community_stickers").insert({ id: stickerId, pack_id: input.packId, community_id: input.communityId, name, title, image_url: storagePath, storage_path: storagePath, created_by: input.createdBy, moderation_status: "active" }).select("id,pack_id,community_id,name,title,image_url,storage_path,created_by,created_at,moderation_status,deleted_at").single();
    if (inserted.error) { await client.storage.from(STICKER_BUCKET).remove([storagePath]); return { ok: false, message: inserted.error.code === "23505" ? "Sticker names must be unique in this community." : "Could not save sticker." }; }
    return { ok: true, data: await mapSticker(inserted.data) };
  },
  async setPackEnabled(input: { communityId: string; packId: string; enabled: boolean; canManage: boolean }): Promise<Result<void>> {
    if (!input.canManage) return { ok: false, message: "You do not have permission to moderate sticker packs." };
    if (dataSourceService.getStatus().isMock) {
      const all = readAll(); all[input.communityId] = (all[input.communityId] ?? []).map((pack) => pack.id === input.packId ? { ...pack, moderationStatus: input.enabled ? "active" : "disabled" } : pack); writeAll(all); return { ok: true, data: undefined };
    }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Sticker pack moderation is unavailable." };
    const result = await client.from("community_sticker_packs").update({ moderation_status: input.enabled ? "active" : "disabled" }).eq("community_id", input.communityId).eq("id", input.packId);
    return result.error ? { ok: false, message: "Could not update sticker pack." } : { ok: true, data: undefined };
  },
};
