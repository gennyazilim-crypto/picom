import { currentUserId } from "../../data/mockCommunities";
import type { PodcastPlaybackProgress } from "../../types/audio";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";

type SaveProgressInput = Readonly<{ episodeId: string; positionSeconds: number; durationSeconds: number }>;
type ProgressResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: string }>;

const STORAGE_KEY = "picom.podcastPlaybackProgress.v1";
const ok = <T,>(data: T): ProgressResult<T> => ({ ok: true, data });
const fail = <T,>(error: string): ProgressResult<T> => ({ ok: false, error });

function readMock(): Record<string, PodcastPlaybackProgress> {
  if (typeof window === "undefined") return {};
  try {
    const all = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, Record<string, PodcastPlaybackProgress>>;
    return all[currentUserId] ?? {};
  } catch { return {}; }
}

function writeMock(items: Record<string, PodcastPlaybackProgress>): void {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, Record<string, PodcastPlaybackProgress>>;
    all[currentUserId] = items;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* Restricted desktop storage keeps playback functional without persistence. */ }
}

function normalize(input: SaveProgressInput): Readonly<{ position: number; duration: number; completedAt?: string }> {
  const duration = Math.max(0, Math.floor(input.durationSeconds));
  const position = Math.min(duration || Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(input.positionSeconds)));
  return { position, duration, completedAt: duration > 0 && position >= Math.max(0, duration - 5) ? new Date().toISOString() : undefined };
}

export const podcastProgressService = {
  async get(episodeId: string): Promise<ProgressResult<PodcastPlaybackProgress | null>> {
    if (dataSourceService.getStatus().isMock) return ok(readMock()[episodeId] ?? null);
    const client = getSupabaseClient();
    if (!client) return fail("Podcast resume state is unavailable.");
    const result = await client.from("podcast_playback_progress").select("user_id,episode_id,position_seconds,duration_seconds,completed_at,last_played_at").eq("episode_id", episodeId).maybeSingle();
    if (result.error) return fail("Picom could not load Podcast resume state.");
    return ok(result.data ? { episodeId: result.data.episode_id, userId: result.data.user_id, positionSeconds: result.data.position_seconds, durationSeconds: result.data.duration_seconds, completedAt: result.data.completed_at ?? undefined, lastPlayedAt: result.data.last_played_at } : null);
  },

  async save(input: SaveProgressInput): Promise<ProgressResult<PodcastPlaybackProgress>> {
    const value = normalize(input);
    const lastPlayedAt = new Date().toISOString();
    if (dataSourceService.getStatus().isMock) {
      const progress = { episodeId: input.episodeId, userId: currentUserId, positionSeconds: value.position, durationSeconds: value.duration, completedAt: value.completedAt, lastPlayedAt } satisfies PodcastPlaybackProgress;
      writeMock({ ...readMock(), [input.episodeId]: progress });
      return ok(progress);
    }
    const client = getSupabaseClient();
    if (!client) return fail("Podcast resume state is unavailable.");
    const auth = await client.auth.getUser();
    if (!auth.data.user) return fail("Sign in again to save Podcast progress.");
    const result = await client.from("podcast_playback_progress").upsert({ user_id: auth.data.user.id, episode_id: input.episodeId, position_seconds: value.position, duration_seconds: value.duration, completed_at: value.completedAt ?? null, last_played_at: lastPlayedAt }, { onConflict: "user_id,episode_id" }).select("user_id,episode_id,position_seconds,duration_seconds,completed_at,last_played_at").single();
    if (result.error) return fail("Picom could not save Podcast progress.");
    return ok({ episodeId: result.data.episode_id, userId: result.data.user_id, positionSeconds: result.data.position_seconds, durationSeconds: result.data.duration_seconds, completedAt: result.data.completed_at ?? undefined, lastPlayedAt: result.data.last_played_at });
  },

  async clear(episodeId: string): Promise<ProgressResult<boolean>> {
    if (dataSourceService.getStatus().isMock) { const items = readMock(); delete items[episodeId]; writeMock(items); return ok(true); }
    const client = getSupabaseClient();
    if (!client) return fail("Podcast resume state is unavailable.");
    const result = await client.from("podcast_playback_progress").delete().eq("episode_id", episodeId);
    return result.error ? fail("Picom could not clear Podcast progress.") : ok(true);
  },
};
