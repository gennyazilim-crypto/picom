import { currentUserId } from "../../data/mockCommunities";
import { mockPodcastEpisodes, mockRadioSessions } from "../../data/mockAudio";
import type {
  AudioCommentPreview,
  AudioFeedItem,
  AudioReactionSummary,
  PodcastEpisode,
  PodcastEpisodeStatus,
  RadioSession,
  RadioSessionStatus,
} from "../../types/audio";
import { dataSourceService } from "../dataSourceService";
import type { Database } from "../supabase/database.types";
import { getSupabaseClient } from "../supabase/supabaseClient";

export type AudioServiceErrorCode =
  | "AUDIO_BACKEND_UNAVAILABLE"
  | "AUDIO_NOT_FOUND"
  | "AUDIO_VALIDATION_ERROR"
  | "AUDIO_REQUEST_FAILED";
export type AudioServiceResult<T> = Readonly<
  | { ok: true; data: T }
  | { ok: false; error: { code: AudioServiceErrorCode; message: string } }
>;
export type AudioCatalogSnapshot = Readonly<{
  radioSessions: RadioSession[];
  podcastEpisodes: PodcastEpisode[];
  feedItems: AudioFeedItem[];
}>;
export type StartRadioSessionInput = Readonly<{
  communityId: string;
  channelId?: string;
  title: string;
  description: string;
  startsAt: string;
  coverUrl?: string;
  status?: "scheduled" | "live";
}>;

type RadioRow = Database["public"]["Tables"]["radio_sessions"]["Row"];
type PodcastRow = Database["public"]["Tables"]["podcast_episodes"]["Row"];
type ReactionRow = Database["public"]["Tables"]["podcast_episode_reactions"]["Row"];
type CommentRow = Database["public"]["Tables"]["podcast_episode_comments"]["Row"];

const ok = <T,>(data: T): AudioServiceResult<T> => ({ ok: true, data });
const fail = <T,>(code: AudioServiceErrorCode, message: string): AudioServiceResult<T> => ({ ok: false, error: { code, message } });
let localRadio = mockRadioSessions.map((item) => ({ ...item }));
let localPodcasts = mockPodcastEpisodes.map((item) => ({ ...item, reactionSummary: [...item.reactionSummary], commentPreview: [...item.commentPreview] }));
const localSavedRadio = new Set(localRadio.filter((item) => item.isSavedByCurrentUser).map((item) => item.id));
const localSavedPodcasts = new Set(localPodcasts.filter((item) => item.isSavedByCurrentUser).map((item) => item.id));

function feedFromCatalog(radio: RadioSession[], podcasts: PodcastEpisode[]): AudioFeedItem[] {
  return [
    ...radio.filter((item) => item.status === "live" || item.status === "scheduled").map((item): AudioFeedItem => ({
      id: `feed-${item.id}`, type: item.status === "live" ? "radio_live" : "radio_scheduled",
      communityId: item.communityId, hostUserId: item.hostUserId, title: item.title,
      body: item.description, coverUrl: item.coverUrl, createdAt: item.startsAt,
      startsAt: item.startsAt, listenerCount: item.listenerCount,
      isUnread: item.status === "live", isSaved: item.isSavedByCurrentUser,
    })),
    ...podcasts.filter((item) => item.status === "published").map((item): AudioFeedItem => ({
      id: `feed-${item.id}`, type: "podcast_episode", communityId: item.communityId,
      authorUserId: item.authorUserId, title: item.title, body: item.description,
      coverUrl: item.coverUrl, createdAt: item.publishedAt, durationSeconds: item.durationSeconds,
      listenerCount: item.listenerCount, reactionSummary: item.reactionSummary,
      commentPreview: item.commentPreview, commentCount: item.commentCount,
      isSaved: item.isSavedByCurrentUser,
    })),
  ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function localSnapshot(): AudioCatalogSnapshot {
  const radioSessions = localRadio.map((item) => ({ ...item, isSavedByCurrentUser: localSavedRadio.has(item.id) }));
  const podcastEpisodes = localPodcasts.map((item) => ({
    ...item,
    isSavedByCurrentUser: localSavedPodcasts.has(item.id),
    reactionSummary: [...item.reactionSummary],
    commentPreview: [...item.commentPreview],
  }));
  return { radioSessions, podcastEpisodes, feedItems: feedFromCatalog(radioSessions, podcastEpisodes) };
}

function clone(value: AudioCatalogSnapshot): AudioCatalogSnapshot {
  return {
    radioSessions: value.radioSessions.map((item) => ({ ...item })),
    podcastEpisodes: value.podcastEpisodes.map((item) => ({ ...item, reactionSummary: [...item.reactionSummary], commentPreview: [...item.commentPreview] })),
    feedItems: value.feedItems.map((item) => ({ ...item })),
  };
}

let snapshot: AudioCatalogSnapshot = dataSourceService.getStatus().isMock
  ? localSnapshot()
  : { radioSessions: [], podcastEpisodes: [], feedItems: [] };
let refreshInFlight: Promise<AudioServiceResult<AudioCatalogSnapshot>> | null = null;
const listeners = new Set<(value: AudioCatalogSnapshot) => void>();

function publish(value: AudioCatalogSnapshot) {
  snapshot = clone(value);
  listeners.forEach((listener) => listener(clone(snapshot)));
}

function radioStatus(value: string): RadioSessionStatus {
  return value === "live" || value === "ended" ? value : "scheduled";
}

function podcastStatus(value: string): PodcastEpisodeStatus {
  return value === "published" || value === "archived" ? value : "draft";
}

function mapRadio(row: RadioRow, savedIds: ReadonlySet<string>): RadioSession {
  return {
    id: row.id, communityId: row.community_id, channelId: row.channel_id ?? undefined,
    hostUserId: row.host_user_id, title: row.title, description: row.description,
    status: radioStatus(row.status), startsAt: row.starts_at, endedAt: row.ended_at ?? undefined,
    listenerCount: row.listener_count, speakerCount: 1, coverUrl: row.cover_url ?? undefined,
    tags: [], isFeatured: false, isSavedByCurrentUser: savedIds.has(row.id),
  };
}

function mapPodcast(
  row: PodcastRow,
  reactions: ReactionRow[],
  comments: CommentRow[],
  savedIds: ReadonlySet<string>,
): PodcastEpisode {
  const grouped = new Map<string, AudioReactionSummary>();
  reactions.filter((item) => item.episode_id === row.id).forEach((item) => {
    const prior = grouped.get(item.emoji);
    grouped.set(item.emoji, {
      emoji: item.emoji,
      count: (prior?.count ?? 0) + 1,
      reactedByCurrentUser: prior?.reactedByCurrentUser || item.user_id === currentUserId,
    });
  });
  const visible = comments.filter((item) => item.episode_id === row.id && !item.deleted_at);
  return {
    id: row.id, communityId: row.community_id, authorUserId: row.author_user_id,
    title: row.title, description: row.description, coverUrl: row.cover_url ?? undefined,
    audioUrl: row.audio_url ?? undefined, durationSeconds: row.duration_seconds,
    publishedAt: row.published_at ?? row.created_at, tags: [], reactionSummary: [...grouped.values()],
    commentPreview: visible.slice(0, 3).map((item) => ({
      id: item.id, authorId: item.author_id ?? "deleted-user", body: item.body, createdAt: item.created_at,
    })),
    commentCount: visible.length, listenerCount: 0,
    isSavedByCurrentUser: savedIds.has(row.id), status: podcastStatus(row.status),
  };
}

async function authenticatedUserId() {
  const client = getSupabaseClient();
  if (!client) return null;
  const result = await client.auth.getUser();
  return result.data.user?.id ?? null;
}

async function loadSupabaseCatalog(): Promise<AudioServiceResult<AudioCatalogSnapshot>> {
  const client = getSupabaseClient();
  if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Audio is unavailable while Supabase is not configured.");
  const [radio, podcasts, reactions, comments, saved] = await Promise.all([
    client.from("radio_sessions").select("id,community_id,channel_id,host_user_id,title,description,status,starts_at,ended_at,cover_url,listener_count,created_at,updated_at").order("starts_at", { ascending: false }).limit(200),
    client.from("podcast_episodes").select("id,community_id,author_user_id,title,description,cover_url,audio_url,duration_seconds,status,published_at,created_at,updated_at").order("published_at", { ascending: false }).limit(200),
    client.from("podcast_episode_reactions").select("id,episode_id,user_id,emoji,created_at").limit(1000),
    client.from("podcast_episode_comments").select("id,episode_id,author_id,body,created_at,updated_at,deleted_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(600),
    client.from("saved_audio_items").select("id,user_id,item_type,item_id,created_at").limit(500),
  ]);
  if (radio.error || podcasts.error || reactions.error || comments.error || saved.error) {
    return fail("AUDIO_REQUEST_FAILED", "Picom could not load audio right now.");
  }
  const savedRadio = new Set((saved.data ?? []).filter((item) => item.item_type === "radio_session").map((item) => item.item_id));
  const savedPodcasts = new Set((saved.data ?? []).filter((item) => item.item_type === "podcast_episode").map((item) => item.item_id));
  const radioSessions = (radio.data ?? []).map((item) => mapRadio(item, savedRadio));
  const podcastEpisodes = (podcasts.data ?? []).map((item) => mapPodcast(item, reactions.data ?? [], comments.data ?? [], savedPodcasts));
  return ok({ radioSessions, podcastEpisodes, feedItems: feedFromCatalog(radioSessions, podcastEpisodes) });
}

async function refresh(): Promise<AudioServiceResult<AudioCatalogSnapshot>> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const result = dataSourceService.getStatus().isMock ? ok(localSnapshot()) : await loadSupabaseCatalog();
    if (result.ok) publish(result.data);
    return result;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

async function setSaved(
  itemType: "radio_session" | "podcast_episode",
  itemId: string,
  saved: boolean,
): Promise<AudioServiceResult<boolean>> {
  if (dataSourceService.getStatus().isMock) {
    const target = itemType === "radio_session" ? localSavedRadio : localSavedPodcasts;
    if (saved) target.add(itemId); else target.delete(itemId);
    publish(localSnapshot());
    return ok(saved);
  }
  const client = getSupabaseClient();
  const userId = await authenticatedUserId();
  if (!client || !userId) return fail("AUDIO_BACKEND_UNAVAILABLE", "Sign in again before changing saved audio.");
  const result = saved
    ? await client.from("saved_audio_items").upsert({ user_id: userId, item_type: itemType, item_id: itemId }, { onConflict: "user_id,item_type,item_id" })
    : await client.from("saved_audio_items").delete().eq("user_id", userId).eq("item_type", itemType).eq("item_id", itemId);
  if (result.error) return fail("AUDIO_REQUEST_FAILED", "Picom could not update saved audio.");
  await refresh();
  return ok(saved);
}

export const audioDataSource = {
  getSnapshot: () => clone(snapshot),
  subscribe(listener: (value: AudioCatalogSnapshot) => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  refresh,

  async listRadioSessions(communityId?: string): Promise<AudioServiceResult<RadioSession[]>> {
    const result = await refresh();
    return result.ok ? ok(result.data.radioSessions.filter((item) => !communityId || item.communityId === communityId)) : result;
  },
  async getRadioSession(id: string): Promise<AudioServiceResult<RadioSession>> {
    const result = await refresh();
    if (!result.ok) return result;
    const item = result.data.radioSessions.find((candidate) => candidate.id === id);
    return item ? ok(item) : fail("AUDIO_NOT_FOUND", "Radio session was not found or is not available to you.");
  },
  async startRadioSession(input: StartRadioSessionInput): Promise<AudioServiceResult<RadioSession>> {
    const title = input.title.trim();
    if (!title || title.length > 120 || !Number.isFinite(Date.parse(input.startsAt))) {
      return fail("AUDIO_VALIDATION_ERROR", "Enter a valid radio title and start time.");
    }
    if (dataSourceService.getStatus().isMock) {
      const item: RadioSession = {
        id: `radio-${crypto.randomUUID()}`, communityId: input.communityId, channelId: input.channelId,
        hostUserId: currentUserId, title, description: input.description.trim().slice(0, 4000),
        status: input.status ?? "scheduled", startsAt: input.startsAt, listenerCount: 0,
        speakerCount: 1, coverUrl: input.coverUrl, tags: [], isFeatured: false,
        isSavedByCurrentUser: false,
      };
      localRadio = [item, ...localRadio];
      publish(localSnapshot());
      return ok(item);
    }
    const client = getSupabaseClient();
    const userId = await authenticatedUserId();
    if (!client || !userId) return fail("AUDIO_BACKEND_UNAVAILABLE", "Sign in again before starting radio.");
    const result = await client.from("radio_sessions").insert({
      community_id: input.communityId, channel_id: input.channelId ?? null, host_user_id: userId,
      title, description: input.description.trim().slice(0, 4000), status: input.status ?? "scheduled",
      starts_at: input.startsAt, cover_url: input.coverUrl ?? null,
    }).select().single();
    if (result.error || !result.data) return fail("AUDIO_REQUEST_FAILED", "Picom could not create the radio session.");
    await refresh();
    return ok(mapRadio(result.data, new Set()));
  },
  async endRadioSession(id: string): Promise<AudioServiceResult<RadioSession>> {
    const endedAt = new Date().toISOString();
    if (dataSourceService.getStatus().isMock) {
      let updated: RadioSession | undefined;
      localRadio = localRadio.map((item) => item.id === id ? (updated = { ...item, status: "ended", endedAt }) : item);
      if (!updated) return fail("AUDIO_NOT_FOUND", "Radio session was not found.");
      publish(localSnapshot());
      return ok(updated);
    }
    const client = getSupabaseClient();
    if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Radio is unavailable.");
    const result = await client.from("radio_sessions").update({ status: "ended", ended_at: endedAt }).eq("id", id).select().single();
    if (result.error || !result.data) return fail("AUDIO_REQUEST_FAILED", "Picom could not end this radio session.");
    await refresh();
    return ok(mapRadio(result.data, new Set()));
  },
  async setListening(id: string, listening: boolean): Promise<AudioServiceResult<boolean>> {
    if (dataSourceService.getStatus().isMock) {
      localRadio = localRadio.map((item) => item.id === id
        ? { ...item, listenerCount: Math.max(0, item.listenerCount + (listening ? 1 : -1)) }
        : item);
      publish(localSnapshot());
      return ok(listening);
    }
    const client = getSupabaseClient();
    const userId = await authenticatedUserId();
    if (!client || !userId) return fail("AUDIO_BACKEND_UNAVAILABLE", "Sign in again before listening.");
    const result = listening
      ? await client.from("radio_listeners").insert({ radio_session_id: id, user_id: userId })
      : await client.from("radio_listeners").update({ left_at: new Date().toISOString() }).eq("radio_session_id", id).eq("user_id", userId).is("left_at", null);
    return result.error
      ? fail("AUDIO_REQUEST_FAILED", listening ? "Picom could not join this radio session." : "Picom could not leave this radio session.")
      : ok(listening);
  },
  setRadioSaved: (id: string, saved: boolean) => setSaved("radio_session", id, saved),

  async listPodcastEpisodes(communityId?: string, userId?: string): Promise<AudioServiceResult<PodcastEpisode[]>> {
    const result = await refresh();
    return result.ok
      ? ok(result.data.podcastEpisodes.filter((item) => (!communityId || item.communityId === communityId) && (!userId || item.authorUserId === userId)))
      : result;
  },
  async getPodcastEpisode(id: string): Promise<AudioServiceResult<PodcastEpisode>> {
    const result = await refresh();
    if (!result.ok) return result;
    const item = result.data.podcastEpisodes.find((candidate) => candidate.id === id);
    return item ? ok(item) : fail("AUDIO_NOT_FOUND", "Podcast episode was not found or is not available to you.");
  },
  setPodcastSaved: (id: string, saved: boolean) => setSaved("podcast_episode", id, saved),
  async reactToPodcastEpisode(id: string, emoji: string): Promise<AudioServiceResult<boolean>> {
    const cleanEmoji = emoji.trim().slice(0, 32);
    if (!cleanEmoji) return fail("AUDIO_VALIDATION_ERROR", "Choose a valid reaction.");
    if (dataSourceService.getStatus().isMock) {
      localPodcasts = localPodcasts.map((item) => item.id !== id ? item : {
        ...item,
        reactionSummary: item.reactionSummary.some((reaction) => reaction.emoji === cleanEmoji)
          ? item.reactionSummary.map((reaction) => reaction.emoji === cleanEmoji ? { ...reaction, count: reaction.count + 1, reactedByCurrentUser: true } : reaction)
          : [...item.reactionSummary, { emoji: cleanEmoji, count: 1, reactedByCurrentUser: true }],
      });
      publish(localSnapshot());
      return ok(true);
    }
    const client = getSupabaseClient();
    const userId = await authenticatedUserId();
    if (!client || !userId) return fail("AUDIO_BACKEND_UNAVAILABLE", "Sign in again before reacting.");
    const result = await client.from("podcast_episode_reactions").upsert(
      { episode_id: id, user_id: userId, emoji: cleanEmoji },
      { onConflict: "episode_id,user_id,emoji" },
    );
    if (result.error) return fail("AUDIO_REQUEST_FAILED", "Picom could not add this reaction.");
    await refresh();
    return ok(true);
  },
  async commentOnPodcastEpisode(id: string, body: string): Promise<AudioServiceResult<AudioCommentPreview>> {
    const cleanBody = body.trim().slice(0, 4000);
    if (!cleanBody) return fail("AUDIO_VALIDATION_ERROR", "Comment text is required.");
    if (dataSourceService.getStatus().isMock) {
      const comment: AudioCommentPreview = {
        id: `audio-comment-${crypto.randomUUID()}`,
        authorId: currentUserId,
        body: cleanBody,
        createdAt: new Date().toISOString(),
      };
      localPodcasts = localPodcasts.map((item) => item.id === id
        ? { ...item, commentPreview: [comment, ...item.commentPreview].slice(0, 3), commentCount: item.commentCount + 1 }
        : item);
      publish(localSnapshot());
      return ok(comment);
    }
    const client = getSupabaseClient();
    const userId = await authenticatedUserId();
    if (!client || !userId) return fail("AUDIO_BACKEND_UNAVAILABLE", "Sign in again before commenting.");
    const result = await client.from("podcast_episode_comments").insert({
      episode_id: id,
      author_id: userId,
      body: cleanBody,
    }).select().single();
    if (result.error || !result.data) return fail("AUDIO_REQUEST_FAILED", "Picom could not add this comment.");
    await refresh();
    return ok({ id: result.data.id, authorId: result.data.author_id ?? userId, body: result.data.body, createdAt: result.data.created_at });
  },
};
