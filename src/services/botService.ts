import type { BotProfile } from "../types/bots";
import { dataSourceService } from "./dataSourceService";

const STORAGE_KEY = "picom.communityBots.v1";
type Result<T> = { ok: true; data: T } | { ok: false; message: string };
function defaults(communityId: string, ownerId: string): BotProfile[] { return [{ id: `bot-${communityId}-helper`, ownerId, displayName: "Picom Helper", communityId, roleId: "member", isBot: true, createdAt: "2026-07-01T09:00:00.000Z" }, { id: `bot-${communityId}-reminder`, ownerId, displayName: "Reminder Bot", communityId, roleId: "member", isBot: true, createdAt: "2026-07-02T09:00:00.000Z" }]; }
function readAll(): Record<string, BotProfile[]> { try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, BotProfile[]>; } catch { return {}; } }
function writeAll(value: Record<string, BotProfile[]>): void { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* restricted fallback */ } }

export const botService = {
  listInstalledBots(communityId: string, ownerId: string): BotProfile[] { const all = readAll(); if (!all[communityId]) { all[communityId] = defaults(communityId, ownerId); writeAll(all); } return all[communityId].map((bot) => ({ ...bot })); },
  addBotPlaceholder(communityId: string, ownerId: string, canManage: boolean): Result<BotProfile> {
    if (!canManage) return { ok: false, message: "You do not have permission to manage bots." };
    if (!dataSourceService.getStatus().isMock) return { ok: false, message: "Bot provisioning requires a future trusted server function." };
    const all = readAll(); const current = all[communityId] ?? defaults(communityId, ownerId); const bot: BotProfile = { id: `bot-${crypto.randomUUID()}`, ownerId, displayName: `Workspace Bot ${current.length + 1}`, communityId, roleId: "member", isBot: true, createdAt: new Date().toISOString() }; all[communityId] = [...current, bot]; writeAll(all); return { ok: true, data: bot };
  },
  removeBot(communityId: string, botId: string, canManage: boolean): Result<void> {
    if (!canManage) return { ok: false, message: "You do not have permission to manage bots." };
    if (!dataSourceService.getStatus().isMock) return { ok: false, message: "Bot removal requires authenticated Supabase role enforcement." };
    const all = readAll(); all[communityId] = (all[communityId] ?? []).filter((bot) => bot.id !== botId); writeAll(all); return { ok: true, data: undefined };
  },
};
