import { currentUserId, mockCommunities } from "../../data/mockCommunities";
import { mockPodcastEpisodes, mockRadioSessions } from "../../data/mockAudio";
import type {
  AudioCommentPreview,
  AudioFeedItem,
  AudioReactionSummary,
  PodcastEpisode,
  PodcastEpisodeStatus,
  RadioAuditEntry,
  RadioSession,
  RadioSessionHostAssignment,
  RadioSessionHostRole,
  RadioSessionStatus,
} from "../../types/audio";
import type { CommunityKind } from "../../types/community";
import { communityService } from "../communityService";
import { auditLogService } from "../auditLogService";
import { dataSourceService } from "../dataSourceService";
import type { Database } from "../supabase/database.types";
import { getSupabaseClient } from "../supabase/supabaseClient";

export type AudioServiceErrorCode =
  | "AUDIO_BACKEND_UNAVAILABLE"
  | "AUDIO_KIND_MISMATCH"
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
  coverStoragePath?: string;
  streamUrl?: string;
  status?: "draft" | "scheduled" | "live";
  programId?: string;
  scheduledEndAt?: string;
  listenerChatChannelId?: string;
}>;
export type UpdateRadioScheduleInput = Readonly<{ title?: string; description?: string; startsAt?: string; scheduledEndAt?: string | null; programId?: string | null; listenerChatChannelId?: string | null; coverUrl?: string | null; coverStoragePath?: string | null }>;
export type AssignRadioSessionHostInput = Readonly<{ sessionId: string; userId: string; hostRole?: "host" | "co_host" | "producer" }>;
export type RadioListenerState = Readonly<{ userId: string; muted: boolean; joinedAt: string }>;
export type RadioListenerModerationAction = "mute" | "unmute" | "remove";

type RadioRow = Database["public"]["Tables"]["radio_sessions"]["Row"];
type RadioReactionRow = Database["public"]["Tables"]["radio_session_reactions"]["Row"];
type PodcastRow = Database["public"]["Tables"]["podcast_episodes"]["Row"];
type ReactionRow = Database["public"]["Tables"]["podcast_episode_reactions"]["Row"];
type CommentRow = Database["public"]["Tables"]["podcast_episode_comments"]["Row"];

const ok = <T,>(data: T): AudioServiceResult<T> => ({ ok: true, data });
const fail = <T,>(code: AudioServiceErrorCode, message: string): AudioServiceResult<T> => ({ ok: false, error: { code, message } });
let localRadio: RadioSession[] = mockRadioSessions.map((item) => ({ ...item, reactionSummary: [...(item.reactionSummary ?? [])] }));
let localPodcasts = mockPodcastEpisodes.map((item) => ({ ...item, reactionSummary: [...item.reactionSummary], commentPreview: [...item.commentPreview] }));
const localSavedRadio = new Set(localRadio.filter((item) => item.isSavedByCurrentUser).map((item) => item.id));
const localSavedPodcasts = new Set(localPodcasts.filter((item) => item.isSavedByCurrentUser).map((item) => item.id));
const localListeningSessions = new Set<string>();
const localListenerMuted = new Map<string, boolean>();
const initialHostAssignmentAt = new Date().toISOString();
const localSessionHosts = new Map<string, Map<string, RadioSessionHostAssignment>>(localRadio.map((session) => [
  session.id,
  new Map([[session.hostUserId, {
    id: "mock-radio-host-" + session.id + "-" + session.hostUserId,
    radioSessionId: session.id,
    userId: session.hostUserId,
    hostRole: "host",
    assignedBy: session.hostUserId,
    assignedAt: initialHostAssignmentAt,
  }]]),
]));

function mockAssignmentRank(role: RadioSessionHostRole): number {
  return role === "producer" ? 70 : role === "host" ? 50 : 40;
}

function getMockRoleContext(communityId: string, userId: string) {
  const community = mockCommunities.find((candidate) => candidate.id === communityId);
  const member = community?.members.find((candidate) => candidate.userId === userId);
  const role = member ? community?.roles.find((candidate) => candidate.id === member.roleId) : undefined;
  return { community, member, role };
}

function canMockManageHostAssignment(communityId: string, targetUserId: string, hostRole: RadioSessionHostRole, requireCapability: boolean): boolean {
  const actor = getMockRoleContext(communityId, currentUserId);
  const target = getMockRoleContext(communityId, targetUserId);
  if (!actor.community || !actor.member || !actor.role || !target.member || !target.role) return false;
  const actorIsOwner = actor.community.ownerId === currentUserId;
  const actorCapabilities = new Set(actor.role.capabilities ?? []);
  const actorCanAssign = actorIsOwner
    || actor.role.level >= 80
    || actorCapabilities.has("manageCommunity")
    || actorCapabilities.has("manageRadioCommunity")
    || actorCapabilities.has("manageRadioPrograms")
    || actorCapabilities.has("manageRadioHosts");
  if (!actorCanAssign) return false;
  if (!actorIsOwner && (targetUserId === currentUserId || targetUserId === actor.community.ownerId || target.role.level >= actor.role.level || mockAssignmentRank(hostRole) >= actor.role.level)) return false;
  if (!requireCapability) return true;
  const targetCapabilities = new Set(target.role.capabilities ?? []);
  return target.role.level >= 80
    || targetCapabilities.has("manageCommunity")
    || (hostRole === "producer"
      ? targetCapabilities.has("manageRadioHosts") || targetCapabilities.has("manageRadioPrograms")
      : targetCapabilities.has("hostRadio"));
}

function canMockModerateListener(communityId: string, targetUserId: string): boolean {
  const actor = getMockRoleContext(communityId, currentUserId);
  const target = getMockRoleContext(communityId, targetUserId);
  if (!actor.community || !actor.role || targetUserId === currentUserId || targetUserId === actor.community.ownerId) return false;
  if (actor.community.ownerId === currentUserId) return true;
  return actor.role.level > (target.role?.level ?? 0);
}

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
  const radioSessions = localRadio.map((item) => ({ ...item, reactionSummary: [...(item.reactionSummary ?? [])], isSavedByCurrentUser: localSavedRadio.has(item.id) }));
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
    radioSessions: value.radioSessions.map((item) => ({ ...item, reactionSummary: [...(item.reactionSummary ?? [])] })),
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
  return value === "draft" || value === "live" || value === "ended" || value === "cancelled" ? value : "scheduled";
}

function podcastStatus(value: string): PodcastEpisodeStatus {
  return value === "published" || value === "archived" ? value : "draft";
}

function mapRadio(row: RadioRow, savedIds: ReadonlySet<string>, reactions: readonly RadioReactionRow[] = []): RadioSession {
  const grouped = new Map<string, AudioReactionSummary>();
  reactions.filter((reaction) => reaction.radio_session_id === row.id).forEach((reaction) => {
    const prior = grouped.get(reaction.emoji);
    grouped.set(reaction.emoji, { emoji: reaction.emoji, count: (prior?.count ?? 0) + 1, reactedByCurrentUser: prior?.reactedByCurrentUser || reaction.user_id === currentUserId });
  });
  return {
    id: row.id, communityId: row.community_id, channelId: row.channel_id ?? undefined, programId: row.program_id ?? undefined,
    hostUserId: row.host_user_id, title: row.title, description: row.description,
    status: radioStatus(row.status), startsAt: row.starts_at, scheduledEndAt: row.scheduled_end_at ?? undefined, actualStartedAt: row.actual_started_at ?? undefined, endedAt: row.ended_at ?? undefined,
    listenerChatChannelId: row.listener_chat_channel_id ?? undefined, listenerCount: row.listener_count, speakerCount: 1, coverUrl: row.cover_url ?? undefined, coverStoragePath: row.cover_storage_path ?? undefined, streamUrl: row.stream_url ?? undefined,
    tags: row.tags, reactionSummary: [...grouped.values()], isFeatured: row.is_featured, isSavedByCurrentUser: savedIds.has(row.id),
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
    id: row.id, communityId: row.community_id, seriesId: row.series_id ?? undefined, authorUserId: row.author_user_id,
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

async function ensureCommunityKind(communityId: string, expectedKind: CommunityKind): Promise<AudioServiceResult<true>> {
  const result = await communityService.getCommunityKind(communityId);
  if (!result.ok) return fail("AUDIO_NOT_FOUND", result.error.message);
  if (result.data !== expectedKind) return fail("AUDIO_KIND_MISMATCH", `This action requires a ${expectedKind} community.`);
  return ok(true);
}

async function getRadioCommunityId(id: string): Promise<AudioServiceResult<string>> {
  const catalog = await refresh();
  if (!catalog.ok) return catalog;
  const session = catalog.data.radioSessions.find((item) => item.id === id);
  return session ? ok(session.communityId) : fail("AUDIO_NOT_FOUND", "Radio session was not found or is not available to you.");
}

async function getPodcastCommunityId(id: string): Promise<AudioServiceResult<string>> {
  const catalog = await refresh();
  if (!catalog.ok) return catalog;
  const episode = catalog.data.podcastEpisodes.find((item) => item.id === id);
  return episode ? ok(episode.communityId) : fail("AUDIO_NOT_FOUND", "Podcast episode was not found or is not available to you.");
}

async function transitionRadioSession(id: string, status: "live" | "ended" | "cancelled"): Promise<AudioServiceResult<RadioSession>> {
  const current = await audioDataSource.getRadioSession(id);
  if (!current.ok) return current;
  const kindGuard = await ensureCommunityKind(current.data.communityId, "radio");
  if (!kindGuard.ok) return kindGuard;
  const now = new Date().toISOString();
  if (dataSourceService.getStatus().isMock) {
    let updated: RadioSession | undefined;
    localRadio = localRadio.map((session) => session.id !== id ? session : (updated = { ...session, status, actualStartedAt: status === "live" ? session.actualStartedAt ?? now : session.actualStartedAt, endedAt: status === "ended" || status === "cancelled" ? now : session.endedAt }));
    if (!updated) return fail("AUDIO_NOT_FOUND", "Radio session was not found.");
    publish(localSnapshot());
    await auditLogService.append({ communityId: current.data.communityId, actionType: "community_update", targetType: "radio_session_status", targetId: id, reason: "Radio session status changed to " + status });
    return ok(updated);
  }
  const client = getSupabaseClient();
  if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Radio is unavailable.");
  const result = await client.rpc("transition_radio_session", {
    target_session_id: id,
    next_status: status,
    confirmation_session_title: status === "live" ? null : current.data.title,
  });
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (result.error || !row) return fail("AUDIO_REQUEST_FAILED", "Picom could not change this Radio session state.");
  await refresh();
  return ok(mapRadio(row, localSavedRadio));
}

async function loadSupabaseCatalog(): Promise<AudioServiceResult<AudioCatalogSnapshot>> {
  const client = getSupabaseClient();
  if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Audio is unavailable while Supabase is not configured.");
  const [radio, radioReactions, podcasts, reactions, comments, saved] = await Promise.all([
    client.from("radio_sessions").select("id,community_id,channel_id,program_id,host_user_id,title,description,status,starts_at,scheduled_end_at,actual_started_at,ended_at,listener_chat_channel_id,cover_url,cover_storage_path,stream_url,tags,is_featured,listener_count,created_at,updated_at").order("starts_at", { ascending: false }).limit(200),
    client.from("radio_session_reactions").select("id,radio_session_id,user_id,emoji,created_at").limit(1000),
    client.from("podcast_episodes").select("id,community_id,series_id,author_user_id,title,description,cover_url,audio_url,duration_seconds,status,published_at,created_at,updated_at").order("published_at", { ascending: false }).limit(200),
    client.from("podcast_episode_reactions").select("id,episode_id,user_id,emoji,created_at").limit(1000),
    client.from("podcast_episode_comments").select("id,episode_id,author_id,body,created_at,updated_at,deleted_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(600),
    client.from("saved_audio_items").select("id,user_id,item_type,item_id,created_at").limit(500),
  ]);
  if (radio.error || radioReactions.error || podcasts.error || reactions.error || comments.error || saved.error) {
    return fail("AUDIO_REQUEST_FAILED", "Picom could not load audio right now.");
  }
  const savedRadio = new Set((saved.data ?? []).filter((item) => item.item_type === "radio_session").map((item) => item.item_id));
  const savedPodcasts = new Set((saved.data ?? []).filter((item) => item.item_type === "podcast_episode").map((item) => item.item_id));
  const radioRows = await Promise.all((radio.data ?? []).map(async (item) => {
    if (!item.cover_storage_path) return item;
    const signed = await client.storage.from("audio-covers").createSignedUrl(item.cover_storage_path, 3600);
    return signed.data?.signedUrl ? { ...item, cover_url: signed.data.signedUrl } : item;
  }));
  const radioSessions = radioRows.map((item) => mapRadio(item, savedRadio, radioReactions.data ?? []));
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
    const kindGuard = await ensureCommunityKind(input.communityId, "radio");
    if (!kindGuard.ok) return kindGuard;
    if (dataSourceService.getStatus().isMock) {
      const item: RadioSession = {
        id: `radio-${crypto.randomUUID()}`, communityId: input.communityId, channelId: input.channelId, programId: input.programId,
        hostUserId: currentUserId, title, description: input.description.trim().slice(0, 4000),
        status: input.status ?? "scheduled", startsAt: input.startsAt, scheduledEndAt: input.scheduledEndAt, listenerChatChannelId: input.listenerChatChannelId, listenerCount: 0,
        speakerCount: 1, coverUrl: input.coverUrl, coverStoragePath: input.coverStoragePath, streamUrl: input.streamUrl, tags: [], isFeatured: false,
        isSavedByCurrentUser: false,
      };
      localRadio = [item, ...localRadio];
      localSessionHosts.set(item.id, new Map([[currentUserId, { id: "mock-radio-host-" + item.id + "-" + currentUserId, radioSessionId: item.id, userId: currentUserId, hostRole: "host", assignedBy: currentUserId, assignedAt: new Date().toISOString() }]]));
      publish(localSnapshot());
      await auditLogService.append({ communityId: item.communityId, actionType: "community_update", targetType: "radio_session_create", targetId: item.id, reason: "Radio session created" });
      return ok(item);
    }
    const client = getSupabaseClient();
    const userId = await authenticatedUserId();
    if (!client || !userId) return fail("AUDIO_BACKEND_UNAVAILABLE", "Sign in again before starting radio.");
    const result = await client.from("radio_sessions").insert({
      community_id: input.communityId, channel_id: input.channelId ?? null, program_id: input.programId ?? null, host_user_id: userId,
      title, description: input.description.trim().slice(0, 4000), status: input.status ?? "scheduled",
      starts_at: input.startsAt, scheduled_end_at: input.scheduledEndAt ?? null, listener_chat_channel_id: input.listenerChatChannelId ?? null, cover_url: input.coverUrl ?? null, cover_storage_path: input.coverStoragePath ?? null, stream_url: input.streamUrl ?? null,
    }).select().single();
    if (result.error || !result.data) return fail("AUDIO_REQUEST_FAILED", "Picom could not create the radio session.");
    await refresh();
    return ok(mapRadio(result.data, new Set()));
  },
  async endRadioSession(id: string): Promise<AudioServiceResult<RadioSession>> {
    return transitionRadioSession(id, "ended");
  },
  startScheduledRadioSession: (id: string) => transitionRadioSession(id, "live"),
  cancelRadioSession: (id: string) => transitionRadioSession(id, "cancelled"),
  async updateRadioSchedule(id: string, input: UpdateRadioScheduleInput): Promise<AudioServiceResult<RadioSession>> {
    const current = await audioDataSource.getRadioSession(id);
    if (!current.ok) return current;
    if (current.data.status === "live" || current.data.status === "ended" || current.data.status === "cancelled") return fail("AUDIO_VALIDATION_ERROR", "Only draft or scheduled Radio sessions can be rescheduled.");
    const title = input.title === undefined ? current.data.title : input.title.trim();
    const startsAt = input.startsAt ?? current.data.startsAt;
    if (!title || title.length > 120 || !Number.isFinite(Date.parse(startsAt))) return fail("AUDIO_VALIDATION_ERROR", "Enter a valid Radio title and schedule time.");
    if (dataSourceService.getStatus().isMock) {
      let updated: RadioSession | undefined;
      localRadio = localRadio.map((session) => session.id !== id ? session : (updated = { ...session, title, description: input.description?.trim().slice(0, 4000) ?? session.description, startsAt, scheduledEndAt: input.scheduledEndAt === null ? undefined : input.scheduledEndAt ?? session.scheduledEndAt, programId: input.programId === null ? undefined : input.programId ?? session.programId, listenerChatChannelId: input.listenerChatChannelId === null ? undefined : input.listenerChatChannelId ?? session.listenerChatChannelId, coverUrl: input.coverUrl === null ? undefined : input.coverUrl ?? session.coverUrl, coverStoragePath: input.coverStoragePath === null ? undefined : input.coverStoragePath ?? session.coverStoragePath }));
      if (!updated) return fail("AUDIO_NOT_FOUND", "Radio session was not found.");
      publish(localSnapshot());
      await auditLogService.append({ communityId: current.data.communityId, actionType: "community_update", targetType: "radio_session_update", targetId: id, reason: "Radio schedule or production metadata updated" });
      return ok(updated);
    }
    const client = getSupabaseClient();
    if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Radio is unavailable.");
    const result = await client.from("radio_sessions").update({ title, description: input.description?.trim().slice(0, 4000) ?? current.data.description, starts_at: startsAt, scheduled_end_at: input.scheduledEndAt === undefined ? current.data.scheduledEndAt ?? null : input.scheduledEndAt, program_id: input.programId === undefined ? current.data.programId ?? null : input.programId, listener_chat_channel_id: input.listenerChatChannelId === undefined ? current.data.listenerChatChannelId ?? null : input.listenerChatChannelId, cover_url: input.coverUrl === undefined ? current.data.coverUrl ?? null : input.coverUrl, cover_storage_path: input.coverStoragePath === undefined ? current.data.coverStoragePath ?? null : input.coverStoragePath }).eq("id", id).select().single();
    if (result.error || !result.data) return fail("AUDIO_REQUEST_FAILED", "Picom could not update this Radio schedule.");
    await refresh();
    return ok(mapRadio(result.data, localSavedRadio));
  },
  async setListening(id: string, listening: boolean): Promise<AudioServiceResult<boolean>> {
    if (listening) {
      const source = await getRadioCommunityId(id);
      if (!source.ok) return source;
      const kindGuard = await ensureCommunityKind(source.data, "radio");
      if (!kindGuard.ok) return kindGuard;
    }
    if (dataSourceService.getStatus().isMock) {
      const alreadyListening = localListeningSessions.has(id);
      if (listening) {
        localListeningSessions.add(id);
        localListenerMuted.set(id, false);
      } else {
        localListeningSessions.delete(id);
        localListenerMuted.delete(id);
      }
      if (alreadyListening !== listening) localRadio = localRadio.map((item) => item.id === id ? { ...item, listenerCount: Math.max(0, item.listenerCount + (listening ? 1 : -1)) } : item);
      publish(localSnapshot());
      return ok(listening);
    }
    const client = getSupabaseClient();
    const userId = await authenticatedUserId();
    if (!client || !userId) return fail("AUDIO_BACKEND_UNAVAILABLE", "Sign in again before listening.");
    const result = listening
      ? await client.rpc("join_current_user_radio_listener", { target_session_id: id })
      : await client.rpc("leave_current_user_radio_listener", { target_session_id: id });
    return result.error
      ? fail("AUDIO_REQUEST_FAILED", listening ? "Picom could not join this radio session." : "Picom could not leave this radio session.")
      : (await refresh(), ok(listening));
  },
  async listRadioListeners(id: string): Promise<AudioServiceResult<RadioListenerState[]>> {
    const source = await getRadioCommunityId(id);
    if (!source.ok) return source;
    if (dataSourceService.getStatus().isMock) {
      return ok(localListeningSessions.has(id)
        ? [{ userId: currentUserId, muted: localListenerMuted.get(id) ?? false, joinedAt: new Date().toISOString() }]
        : []);
    }
    const client = getSupabaseClient();
    if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Radio listener controls are unavailable.");
    const result = await client.from("radio_listeners").select("user_id,muted,joined_at").eq("radio_session_id", id).is("left_at", null).order("joined_at");
    if (result.error) return fail("AUDIO_REQUEST_FAILED", "Picom could not load the active Radio audience.");
    return ok((result.data ?? []).map((listener) => ({ userId: listener.user_id, muted: listener.muted, joinedAt: listener.joined_at })));
  },
  async heartbeatRadioListener(id: string): Promise<AudioServiceResult<boolean>> {
    if (dataSourceService.getStatus().isMock) return ok(localListeningSessions.has(id));
    const client = getSupabaseClient();
    if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Radio listener persistence is unavailable.");
    const result = await client.rpc("heartbeat_current_user_radio_listener", { target_session_id: id });
    return result.error ? fail("AUDIO_REQUEST_FAILED", "Picom could not refresh the Radio listener session.") : ok(Boolean(result.data));
  },
  async moderateRadioListener(id: string, userId: string, action: RadioListenerModerationAction): Promise<AudioServiceResult<boolean>> {
    const source = await getRadioCommunityId(id);
    if (!source.ok) return source;
    if (dataSourceService.getStatus().isMock) {
      if (!localListeningSessions.has(id) || userId !== currentUserId) return fail("AUDIO_NOT_FOUND", "That listener is no longer active.");
      if (!canMockModerateListener(source.data, userId)) return fail("AUDIO_REQUEST_FAILED", "You cannot moderate yourself or an equal or higher community role.");
      if (action === "remove") {
        localListeningSessions.delete(id);
        localListenerMuted.delete(id);
        localRadio = localRadio.map((session) => session.id === id ? { ...session, listenerCount: Math.max(0, session.listenerCount - 1) } : session);
      } else localListenerMuted.set(id, action === "mute");
      publish(localSnapshot());
      await auditLogService.append({ communityId: source.data, actionType: "moderation_action", targetType: "radio_listener", targetId: id, reason: "Listener " + userId + ": " + action });
      return ok(true);
    }
    const client = getSupabaseClient();
    if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Radio listener controls are unavailable.");
    const result = await client.rpc("moderate_radio_listener", { target_session_id: id, target_user_id: userId, moderation_action: action });
    if (result.error) return fail("AUDIO_REQUEST_FAILED", "Picom could not apply that listener action.");
    await refresh();
    return ok(true);
  },
  setRadioSaved: (id: string, saved: boolean) => setSaved("radio_session", id, saved),
  async reactToRadioSession(id: string, emoji: string): Promise<AudioServiceResult<boolean>> {
    const cleanEmoji = emoji.trim().slice(0, 32);
    if (!cleanEmoji) return fail("AUDIO_VALIDATION_ERROR", "Choose a valid reaction.");
    const source = await getRadioCommunityId(id);
    if (!source.ok) return source;
    const kindGuard = await ensureCommunityKind(source.data, "radio");
    if (!kindGuard.ok) return kindGuard;
    if (dataSourceService.getStatus().isMock) {
      localRadio = localRadio.map((item) => item.id !== id ? item : { ...item, reactionSummary: (item.reactionSummary ?? []).some((reaction) => reaction.emoji === cleanEmoji) ? (item.reactionSummary ?? []).map((reaction) => reaction.emoji === cleanEmoji ? { ...reaction, count: reaction.count + 1, reactedByCurrentUser: true } : reaction) : [...(item.reactionSummary ?? []), { emoji: cleanEmoji, count: 1, reactedByCurrentUser: true }] });
      publish(localSnapshot());
      return ok(true);
    }
    const client = getSupabaseClient();
    const userId = await authenticatedUserId();
    if (!client || !userId) return fail("AUDIO_BACKEND_UNAVAILABLE", "Sign in again before reacting.");
    const result = await client.from("radio_session_reactions").upsert({ radio_session_id: id, user_id: userId, emoji: cleanEmoji }, { onConflict: "radio_session_id,user_id,emoji" });
    if (result.error) return fail("AUDIO_REQUEST_FAILED", "Picom could not add this Radio reaction.");
    await refresh();
    return ok(true);
  },

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
    const source = await getPodcastCommunityId(id);
    if (!source.ok) return source;
    const kindGuard = await ensureCommunityKind(source.data, "podcast");
    if (!kindGuard.ok) return kindGuard;
    if (dataSourceService.getStatus().isMock) {
      localPodcasts = localPodcasts.map((item) => item.id !== id ? item : {
        ...item,
        reactionSummary: (item.reactionSummary ?? []).some((reaction) => reaction.emoji === cleanEmoji)
          ? (item.reactionSummary ?? []).map((reaction) => reaction.emoji === cleanEmoji ? (reaction.reactedByCurrentUser ? reaction : { ...reaction, count: reaction.count + 1, reactedByCurrentUser: true }) : reaction)
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
  async listRadioSessionHosts(id: string): Promise<AudioServiceResult<RadioSessionHostAssignment[]>> {
    const source = await getRadioCommunityId(id);
    if (!source.ok) return source;
    if (dataSourceService.getStatus().isMock) return ok([...(localSessionHosts.get(id)?.values() ?? [])].map((assignment) => ({ ...assignment })));
    const client = getSupabaseClient();
    if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Radio production team data is unavailable.");
    const result = await client.from("radio_session_hosts").select("id,radio_session_id,user_id,host_role,assigned_by,assigned_at").eq("radio_session_id", id).order("assigned_at");
    if (result.error) return fail("AUDIO_REQUEST_FAILED", "Picom could not load the Radio production team.");
    return ok((result.data ?? []).map((row) => ({ id: row.id, radioSessionId: row.radio_session_id, userId: row.user_id, hostRole: row.host_role, assignedBy: row.assigned_by, assignedAt: row.assigned_at })));
  },
  async listRadioAuditHistory(id: string): Promise<AudioServiceResult<RadioAuditEntry[]>> {
    const source = await getRadioCommunityId(id);
    if (!source.ok) return source;
    if (dataSourceService.getStatus().isMock) {
      const result = await auditLogService.list(source.data, true);
      return result.ok
        ? ok(result.data.filter((entry) => entry.targetId === id && entry.targetType.startsWith("radio_")).map((entry) => ({ id: entry.id, actorUserId: entry.actorId, actionType: entry.actionType, targetType: entry.targetType, reason: entry.reason, createdAt: entry.createdAt })))
        : fail("AUDIO_REQUEST_FAILED", result.message);
    }
    const client = getSupabaseClient();
    if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Radio audit history is unavailable.");
    const result = await client.rpc("list_radio_session_audit", { target_session_id: id, result_limit: 30 });
    if (result.error) return fail("AUDIO_REQUEST_FAILED", "You do not have access to this Radio audit history.");
    return ok((result.data ?? []).map((row) => ({ id: row.id, actorUserId: row.actor_id, actionType: row.action_type, targetType: row.target_type, reason: row.reason ?? undefined, createdAt: row.created_at })));
  },
  async assignRadioSessionHost(input: AssignRadioSessionHostInput): Promise<AudioServiceResult<boolean>> {
    if (!input.userId.trim()) return fail("AUDIO_VALIDATION_ERROR", "Choose a valid Radio host.");
    const source = await getRadioCommunityId(input.sessionId);
    if (!source.ok) return source;
    const kindGuard = await ensureCommunityKind(source.data, "radio");
    if (!kindGuard.ok) return kindGuard;
    if (dataSourceService.getStatus().isMock) {
      const role = input.hostRole ?? "co_host";
      if (!canMockManageHostAssignment(source.data, input.userId, role, true)) return fail("AUDIO_REQUEST_FAILED", "Assign the required common Radio role first, and do not grant an equal or higher assignment.");
      const assigned = localSessionHosts.get(input.sessionId) ?? new Map<string, RadioSessionHostAssignment>();
      const wasAssigned = assigned.has(input.userId);
      assigned.set(input.userId, { id: "mock-radio-host-" + input.sessionId + "-" + input.userId, radioSessionId: input.sessionId, userId: input.userId, hostRole: role, assignedBy: currentUserId, assignedAt: new Date().toISOString() });
      localSessionHosts.set(input.sessionId, assigned);
      if (!wasAssigned) localRadio = localRadio.map((session) => session.id === input.sessionId ? { ...session, speakerCount: session.speakerCount + 1 } : session);
      publish(localSnapshot());
      await auditLogService.append({ communityId: source.data, actionType: "role_change", targetType: "radio_host_assignment", targetId: input.sessionId, reason: "Assigned " + input.userId + " as " + role });
      return ok(true);
    }
    const client = getSupabaseClient();
    if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Sign in again before assigning a Radio host.");
    const result = await client.rpc("assign_radio_session_host", { target_session_id: input.sessionId, target_user_id: input.userId, target_host_role: input.hostRole ?? "co_host" });
    return result.error ? fail("AUDIO_REQUEST_FAILED", "This host assignment is not allowed by the common role hierarchy.") : ok(true);
  },
  async removeRadioSessionHost(sessionId: string, userId: string): Promise<AudioServiceResult<boolean>> {
    const source = await getRadioCommunityId(sessionId);
    if (!source.ok) return source;
    const session = (await audioDataSource.getRadioSession(sessionId));
    if (!session.ok) return session;
    if (session.data.hostUserId === userId) return fail("AUDIO_REQUEST_FAILED", "Transfer the primary host before removing this assignment.");
    if (dataSourceService.getStatus().isMock) {
      const assignments = localSessionHosts.get(sessionId);
      const assignment = assignments?.get(userId);
      if (!assignment) return fail("AUDIO_NOT_FOUND", "That host assignment no longer exists.");
      if (!canMockManageHostAssignment(source.data, userId, assignment.hostRole, false)) return fail("AUDIO_REQUEST_FAILED", "You cannot remove an equal or higher Radio assignment.");
      assignments?.delete(userId);
      localRadio = localRadio.map((item) => item.id === sessionId ? { ...item, speakerCount: Math.max(1, item.speakerCount - 1) } : item);
      publish(localSnapshot());
      await auditLogService.append({ communityId: source.data, actionType: "role_change", targetType: "radio_host_removal", targetId: sessionId, reason: "Removed " + userId + " from " + assignment.hostRole });
      return ok(true);
    }
    const client = getSupabaseClient();
    if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Radio host removal is unavailable.");
    const result = await client.rpc("remove_radio_session_host", { target_session_id: sessionId, target_user_id: userId });
    return result.error ? fail("AUDIO_REQUEST_FAILED", "This host removal is blocked by the common role hierarchy.") : ok(Boolean(result.data));
  },
  async commentOnPodcastEpisode(id: string, body: string): Promise<AudioServiceResult<AudioCommentPreview>> {
    const cleanBody = body.trim().slice(0, 4000);
    if (!cleanBody) return fail("AUDIO_VALIDATION_ERROR", "Comment text is required.");
    const source = await getPodcastCommunityId(id);
    if (!source.ok) return source;
    const kindGuard = await ensureCommunityKind(source.data, "podcast");
    if (!kindGuard.ok) return kindGuard;
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
