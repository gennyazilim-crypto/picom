import { currentUserId } from "../../data/mockCommunities";
import type { AudioFeedItem } from "../../types/audio";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";

type AudioFeedSource = Readonly<{ itemType: "radio_session" | "podcast_episode"; itemId: string; feedId: string }>;

const STORAGE_KEY = "picom.audioFeedReadState.v1";

function sourceFor(item: AudioFeedItem): AudioFeedSource {
  return { itemType: item.type === "podcast_episode" ? "podcast_episode" : "radio_session", itemId: item.sourceId ?? item.id.replace(/^feed-/, ""), feedId: item.id };
}

function readMockKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string[]>;
    return new Set(Array.isArray(value[currentUserId]) ? value[currentUserId] : []);
  } catch { return new Set(); }
}

function writeMockKeys(keys: ReadonlySet<string>): void {
  if (typeof window === "undefined") return;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string[]>;
    value[currentUserId] = [...keys];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch { /* Restricted desktop storage keeps the current in-memory UI state. */ }
}

function sourceKey(source: AudioFeedSource): string { return source.itemType + ":" + source.itemId; }

export const audioFeedReadStateService = {
  async listReadItemIds(items: readonly AudioFeedItem[]): Promise<Set<string>> {
    const sources = items.map(sourceFor);
    const bySource = new Map(sources.map((source) => [sourceKey(source), source.feedId]));
    if (dataSourceService.getStatus().isMock) return new Set([...readMockKeys()].map((key) => bySource.get(key)).filter((id): id is string => Boolean(id)));
    const client = getSupabaseClient();
    if (!client) return new Set();
    const { data, error } = await client.from("audio_feed_read_states").select("item_type,item_id");
    if (error) return new Set();
    return new Set((data ?? []).map((row) => bySource.get(row.item_type + ":" + row.item_id)).filter((id): id is string => Boolean(id)));
  },

  async markRead(item: AudioFeedItem): Promise<boolean> {
    const source = sourceFor(item);
    if (dataSourceService.getStatus().isMock) { const keys = readMockKeys(); keys.add(sourceKey(source)); writeMockKeys(keys); return true; }
    const client = getSupabaseClient();
    if (!client) return false;
    const { data: authData } = await client.auth.getUser();
    if (!authData.user) return false;
    const { error } = await client.from("audio_feed_read_states").upsert({ user_id: authData.user.id, item_type: source.itemType, item_id: source.itemId }, { onConflict: "user_id,item_type,item_id", ignoreDuplicates: true });
    return !error;
  },
};
