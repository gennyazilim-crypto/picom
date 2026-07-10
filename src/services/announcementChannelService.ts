import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.announcementFollowers.v1";
type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function read(): string[] { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
function write(keys: string[]): void { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(keys)); } catch { /* restricted fallback */ } }
function key(channelId: string, userId: string): string { return `${channelId}:${userId}`; }

export const announcementChannelService = {
  async isFollowing(channelId: string, userId: string): Promise<boolean> {
    if (dataSourceService.getStatus().isMock) return read().includes(key(channelId, userId));
    const client = getSupabaseClient(); if (!client) return false;
    const auth = await client.auth.getUser(); if (auth.data.user?.id !== userId) return false;
    const result = await client.from("announcement_channel_followers").select("channel_id").eq("channel_id", channelId).eq("user_id", userId).maybeSingle();
    return !result.error && Boolean(result.data);
  },
  async setFollowing(input: { channelId: string; userId: string; following: boolean; canFollow: boolean }): Promise<Result<boolean>> {
    if (!input.canFollow) return { ok: false, message: "Join this community before following announcements." };
    if (dataSourceService.getStatus().isMock) { const itemKey = key(input.channelId, input.userId); const values = new Set(read()); if (input.following) values.add(itemKey); else values.delete(itemKey); write([...values]); return { ok: true, data: input.following }; }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Announcement following is unavailable." };
    const auth = await client.auth.getUser(); if (auth.data.user?.id !== input.userId) return { ok: false, message: "Sign in again before changing this preference." };
    const result = input.following
      ? await client.from("announcement_channel_followers").upsert({ channel_id: input.channelId, user_id: input.userId }, { onConflict: "channel_id,user_id" })
      : await client.from("announcement_channel_followers").delete().eq("channel_id", input.channelId).eq("user_id", input.userId);
    return result.error ? { ok: false, message: "Could not update announcement following." } : { ok: true, data: input.following };
  },
};
