import type { CommunityEmoji } from "../types/customEmoji";
import { dataSourceService } from "./dataSourceService";
import { fileService } from "./fileService";

const STORAGE_KEY = "picom.communityEmojis.v1";
type Result<T> = { ok: true; data: T } | { ok: false; message: string };
function svgData(label: string, color: string): string { return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="24" fill="${color}"/><text x="48" y="60" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="800" fill="white">${label}</text></svg>`)}`; }
function defaults(communityId: string): CommunityEmoji[] { return [{ id: `${communityId}-emoji-spark`, communityId, name: "picom_spark", imageUrl: svgData("P", "#007571"), createdBy: "picom", createdAt: "2026-07-01T09:00:00.000Z" }, { id: `${communityId}-emoji-wave`, communityId, name: "team_wave", imageUrl: svgData("W", "#C24D0F"), createdBy: "picom", createdAt: "2026-07-01T09:00:00.000Z" }]; }
function readAll(): Record<string, CommunityEmoji[]> { try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, CommunityEmoji[]>; } catch { return {}; } }
function writeAll(value: Record<string, CommunityEmoji[]>): void { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* restricted fallback */ } }
function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("invalid image")); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }

export const customEmojiService = {
  normalizeName(value: string): string { return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_").slice(0, 32); },
  list(communityId: string): CommunityEmoji[] { const all = readAll(); if (!all[communityId]) { all[communityId] = defaults(communityId); writeAll(all); } return all[communityId].filter((item) => !item.deletedAt).map((item) => ({ ...item })); },
  resolve(communityId: string, placeholder: string): CommunityEmoji | undefined { const name = /^:([a-z0-9_]+):$/.exec(placeholder)?.[1]; return name ? this.list(communityId).find((item) => item.name === name) : undefined; },
  async add(input: { communityId: string; name: string; file: File; createdBy: string; canManage: boolean }): Promise<Result<CommunityEmoji>> {
    if (!input.canManage) return { ok: false, message: "You do not have permission to manage emojis." }; const name = this.normalizeName(input.name); if (!name) return { ok: false, message: "Use letters, numbers, and underscores for the emoji name." }; const validation = fileService.validate(input.file); if (!validation.ok) return { ok: false, message: validation.reason }; if (input.file.size > 512 * 1024) return { ok: false, message: "Custom emoji images must be 512 KB or smaller." }; if (!dataSourceService.getStatus().isMock) return { ok: false, message: "Custom emoji upload requires the future protected Storage pipeline." };
    const all = readAll(); const current = all[input.communityId] ?? defaults(input.communityId); if (current.some((item) => !item.deletedAt && item.name === name)) return { ok: false, message: "Emoji names must be unique in this community." }; const emoji: CommunityEmoji = { id: `emoji-${crypto.randomUUID()}`, communityId: input.communityId, name, imageUrl: await fileToDataUrl(input.file), createdBy: input.createdBy, createdAt: new Date().toISOString() }; all[input.communityId] = [...current, emoji]; writeAll(all); return { ok: true, data: emoji };
  },
  remove(communityId: string, emojiId: string, canManage: boolean): Result<void> { if (!canManage) return { ok: false, message: "You do not have permission to manage emojis." }; const all = readAll(); all[communityId] = (all[communityId] ?? []).map((item) => item.id === emojiId ? { ...item, deletedAt: new Date().toISOString() } : item); writeAll(all); return { ok: true, data: undefined }; },
};
