import type { CommunityEmoji } from "../types/customEmoji";
import { dataSourceService } from "./dataSourceService";
import { fileService } from "./fileService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.communityEmojis.v2";
const EMOJI_BUCKET = "community-emojis";
const MAX_EMOJI_BYTES = 512 * 1024;
type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function svgData(label: string, color: string): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="24" fill="${color}"/><text x="48" y="60" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="800" fill="white">${label}</text></svg>`)}`;
}

function defaults(communityId: string): CommunityEmoji[] {
  return [
    { id: `${communityId}-emoji-spark`, communityId, name: "picom_spark", imageUrl: svgData("P", "#007571"), createdBy: "picom", createdAt: "2026-07-01T09:00:00.000Z", moderationStatus: "active" },
    { id: `${communityId}-emoji-wave`, communityId, name: "team_wave", imageUrl: svgData("W", "#C24D0F"), createdBy: "picom", createdAt: "2026-07-01T09:00:00.000Z", moderationStatus: "active" },
  ];
}

function readAll(): Record<string, CommunityEmoji[]> {
  try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, CommunityEmoji[]>; }
  catch { return {}; }
}

function writeAll(value: Record<string, CommunityEmoji[]>): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
  catch { /* restricted fallback */ }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("invalid image"));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function extensionForMime(mimeType: string): string | null {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return null;
}

function mapRow(row: {
  id: string; community_id: string; name: string; image_url: string; storage_path: string | null;
  created_by: string; created_at: string; moderation_status: string; disabled_at: string | null; deleted_at: string | null;
}, signedUrl?: string): CommunityEmoji {
  return {
    id: row.id,
    communityId: row.community_id,
    name: row.name,
    imageUrl: signedUrl ?? row.image_url,
    storagePath: row.storage_path ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    moderationStatus: row.moderation_status === "disabled" ? "disabled" : "active",
    disabledAt: row.disabled_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

export const customEmojiService = {
  normalizeName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32);
  },
  listForManagement(communityId: string): CommunityEmoji[] {
    const all = readAll();
    if (!all[communityId]) { all[communityId] = defaults(communityId); writeAll(all); }
    return all[communityId].filter((item) => !item.deletedAt).map((item) => ({ ...item, moderationStatus: item.moderationStatus ?? "active" }));
  },
  list(communityId: string): CommunityEmoji[] {
    return this.listForManagement(communityId).filter((item) => item.moderationStatus === "active");
  },
  resolve(communityId: string, placeholder: string): CommunityEmoji | undefined {
    const name = /^:([a-z0-9_]+):$/.exec(placeholder)?.[1];
    return name ? this.list(communityId).find((item) => item.name === name) : undefined;
  },
  async listRemote(communityId: string): Promise<Result<CommunityEmoji[]>> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Custom emoji storage is unavailable." };
    const { data, error } = await client.from("community_emojis").select("id,community_id,name,image_url,storage_path,created_by,created_at,moderation_status,disabled_at,deleted_at").eq("community_id", communityId).is("deleted_at", null).order("created_at");
    if (error) return { ok: false, message: "Could not load community emojis." };
    const items = await Promise.all((data ?? []).map(async (row) => {
      if (!row.storage_path) return mapRow(row);
      const signed = await client.storage.from(EMOJI_BUCKET).createSignedUrl(row.storage_path, 60 * 60);
      return mapRow(row, signed.data?.signedUrl);
    }));
    return { ok: true, data: items };
  },
  async add(input: { communityId: string; name: string; file: File; createdBy: string; canManage: boolean }): Promise<Result<CommunityEmoji>> {
    if (!input.canManage) return { ok: false, message: "You do not have permission to manage emojis." };
    const name = this.normalizeName(input.name);
    if (name.length < 2) return { ok: false, message: "Use 2-32 letters, numbers, or underscores for the emoji name." };
    const validation = fileService.validate(input.file);
    if (!validation.ok) return { ok: false, message: validation.reason };
    if (input.file.size > MAX_EMOJI_BYTES) return { ok: false, message: "Custom emoji images must be 512 KB or smaller." };
    const contentValidation = await fileService.validateContent(input.file);
    if (!contentValidation.ok) return { ok: false, message: contentValidation.reason };
    const extension = extensionForMime(input.file.type);
    if (!extension) return { ok: false, message: "Unsupported emoji image type." };

    if (dataSourceService.getStatus().isMock) {
      const all = readAll();
      const current = all[input.communityId] ?? defaults(input.communityId);
      if (current.some((item) => !item.deletedAt && item.name === name)) return { ok: false, message: "Emoji names must be unique in this community." };
      const emoji: CommunityEmoji = { id: `emoji-${crypto.randomUUID()}`, communityId: input.communityId, name, imageUrl: await fileToDataUrl(input.file), createdBy: input.createdBy, createdAt: new Date().toISOString(), moderationStatus: "active" };
      all[input.communityId] = [...current, emoji];
      writeAll(all);
      return { ok: true, data: emoji };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Custom emoji storage is unavailable." };
    const auth = await client.auth.getUser();
    if (!auth.data.user || auth.data.user.id !== input.createdBy) return { ok: false, message: "Sign in again before uploading an emoji." };
    const emojiId = crypto.randomUUID();
    const storagePath = `communities/${input.communityId}/emojis/${emojiId}.${extension}`;
    const upload = await client.storage.from(EMOJI_BUCKET).upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
    if (upload.error) return { ok: false, message: "Could not upload custom emoji." };
    const inserted = await client.from("community_emojis").insert({ id: emojiId, community_id: input.communityId, name, image_url: storagePath, storage_path: storagePath, created_by: input.createdBy, moderation_status: "active" }).select("id,community_id,name,image_url,storage_path,created_by,created_at,moderation_status,disabled_at,deleted_at").single();
    if (inserted.error) {
      await client.storage.from(EMOJI_BUCKET).remove([storagePath]);
      return { ok: false, message: inserted.error.code === "23505" ? "Emoji names must be unique in this community." : "Could not save custom emoji." };
    }
    const signed = await client.storage.from(EMOJI_BUCKET).createSignedUrl(storagePath, 60 * 60);
    return { ok: true, data: mapRow(inserted.data, signed.data?.signedUrl) };
  },
  async setEnabled(communityId: string, emojiId: string, enabled: boolean, canManage: boolean): Promise<Result<void>> {
    if (!canManage) return { ok: false, message: "You do not have permission to moderate emojis." };
    if (dataSourceService.getStatus().isMock) {
      const all = readAll();
      all[communityId] = (all[communityId] ?? []).map((item) => item.id === emojiId ? { ...item, moderationStatus: enabled ? "active" : "disabled", disabledAt: enabled ? undefined : new Date().toISOString() } : item);
      writeAll(all);
      return { ok: true, data: undefined };
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Custom emoji moderation is unavailable." };
    const result = await client.from("community_emojis").update({ moderation_status: enabled ? "active" : "disabled", disabled_at: enabled ? null : new Date().toISOString() }).eq("community_id", communityId).eq("id", emojiId).is("deleted_at", null);
    return result.error ? { ok: false, message: "Could not update emoji moderation state." } : { ok: true, data: undefined };
  },
  async remove(communityId: string, emojiId: string, canManage: boolean): Promise<Result<void>> {
    if (!canManage) return { ok: false, message: "You do not have permission to manage emojis." };
    if (dataSourceService.getStatus().isMock) {
      const all = readAll();
      all[communityId] = (all[communityId] ?? []).map((item) => item.id === emojiId ? { ...item, moderationStatus: "disabled", deletedAt: new Date().toISOString() } : item);
      writeAll(all);
      return { ok: true, data: undefined };
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Custom emoji deletion is unavailable." };
    const result = await client.from("community_emojis").update({ moderation_status: "disabled", disabled_at: new Date().toISOString(), deleted_at: new Date().toISOString() }).eq("community_id", communityId).eq("id", emojiId).is("deleted_at", null);
    return result.error ? { ok: false, message: "Could not delete custom emoji." } : { ok: true, data: undefined };
  },
};
