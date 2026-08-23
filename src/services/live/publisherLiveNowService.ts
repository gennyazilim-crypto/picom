import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type {
  LiveScreenShareCategory,
  LiveScreenShareCursor,
  LiveScreenShareStatus,
  LiveScreenShareSummary,
} from "../../types/liveScreenShare";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import type { Database } from "../supabase/database.types";
import { loggingService } from "../loggingService";

export type PublisherLiveNowSort = "viewers" | "newest" | "following";

export type PublisherLiveNowSummary = LiveScreenShareSummary &
  Readonly<{
    languageCode: string;
    tags: readonly string[];
    publisherBadgeType: string | null;
    broadcasterAvatarUrl: string | null;
    contentWarning: string | null;
    ageRestricted: boolean;
  }>;

export type PublisherLiveNowPage = Readonly<{
  items: readonly PublisherLiveNowSummary[];
  nextCursor: LiveScreenShareCursor | null;
  totalCount: number;
}>;

export type UpcomingPublisherSchedule = Readonly<{
  id: string;
  publisherUserId: string;
  title: string;
  category: string;
  languageCode: string;
  scheduledStartAt: string;
  timezone: string;
  publisherDisplayName: string;
  publisherUsername: string;
  publisherAvatarUrl: string | null;
  publisherBadgeType: string | null;
  tags: readonly string[];
}>;

export type PublisherLiveCategoryCount = Readonly<{
  category: string;
  liveCount: number;
}>;

export type PublisherLiveNowErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "LIVE_FORBIDDEN"
  | "LIVE_LIST_FAILED"
  | "UNKNOWN_ERROR";

export type PublisherLiveNowError = Readonly<{ code: PublisherLiveNowErrorCode; message: string; safeCode: string }>;

export type PublisherLiveNowResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: PublisherLiveNowError }>;

type LiveRpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string; details?: string; hint?: string } | null }>;
};

type LiveNowRow = Readonly<{
  id: string;
  community_id: string;
  channel_id: string;
  broadcaster_user_id: string;
  title: string;
  status: string;
  visibility_mode: string | null;
  category: string;
  language_code: string | null;
  tags: string[] | null;
  viewer_count: number;
  started_at: string;
  last_heartbeat_at: string | null;
  community_name: string | null;
  channel_name: string | null;
  broadcaster_display_name: string | null;
  broadcaster_username: string | null;
  broadcaster_avatar_url: string | null;
  publisher_badge_type: string | null;
  content_warning: string | null;
  age_restricted: boolean | null;
}>;

const LIVE_STATUSES: readonly LiveScreenShareStatus[] = ["starting", "live", "reconnecting", "ended", "terminated"];
const LIVE_CATEGORIES: readonly LiveScreenShareCategory[] = ["game", "chat", "education", "watch_together", "other"];

function rpc(client: SupabaseClient<Database>, fn: string, args: Record<string, unknown> = {}) {
  return (client as unknown as LiveRpcClient).rpc(fn, args);
}

function fail(code: PublisherLiveNowErrorCode, message: string, safeCode = code): PublisherLiveNowResult<never> {
  return { ok: false, error: { code, message, safeCode } };
}

function errorBlob(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const candidate = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  return [candidate.message, candidate.code, candidate.details, candidate.hint]
    .filter((part) => part != null && String(part).trim() !== "")
    .map(String)
    .join(" ");
}

function mapFailure(error: unknown): PublisherLiveNowResult<never> {
  const blob = errorBlob(error).toUpperCase();
  if (blob.includes("AUTH_REQUIRED") || blob.includes("JWT")) {
    return fail("AUTH_REQUIRED", "Sign in to use Live Now.", "AUTH_REQUIRED");
  }
  if (blob.includes("42501") || blob.includes("FORBIDDEN") || blob.includes("PERMISSION")) {
    return fail("LIVE_FORBIDDEN", "You do not have permission to view Live Now.", "LIVE_FORBIDDEN");
  }
  loggingService.logWarn("Live Now request failed", { diagnostic: errorBlob(error).slice(0, 240) }, "live");
  return fail("LIVE_LIST_FAILED", "Could not load Live Now.", "LIVE_LIST_FAILED");
}

function normalizeStatus(value: string): LiveScreenShareStatus {
  return (LIVE_STATUSES as readonly string[]).includes(value) ? (value as LiveScreenShareStatus) : "ended";
}

function normalizeCategory(value: string): LiveScreenShareCategory {
  return (LIVE_CATEGORIES as readonly string[]).includes(value) ? (value as LiveScreenShareCategory) : "other";
}

function mapRow(row: LiveNowRow): PublisherLiveNowSummary {
  return {
    id: row.id,
    livekitRoomName: "",
    communityId: row.community_id,
    channelId: row.channel_id,
    broadcasterUserId: row.broadcaster_user_id,
    title: row.title,
    category: normalizeCategory(row.category),
    applicationName: "",
    status: normalizeStatus(row.status),
    startedAt: row.started_at,
    endedAt: null,
    viewerCount: Number(row.viewer_count ?? 0),
    participantCount: 0,
    previewUpdatedAt: null,
    communityName: row.community_name ?? "",
    channelName: row.channel_name ?? "",
    broadcasterDisplayName: row.broadcaster_display_name ?? "",
    broadcasterUsername: row.broadcaster_username ?? "",
    friendViewerIds: [],
    relevanceScore: Number(row.viewer_count ?? 0),
    languageCode: row.language_code ?? "",
    tags: row.tags ?? [],
    publisherBadgeType: row.publisher_badge_type,
    broadcasterAvatarUrl: row.broadcaster_avatar_url,
    contentWarning: row.content_warning,
    ageRestricted: Boolean(row.age_restricted),
  };
}

function getClient(): PublisherLiveNowResult<SupabaseClient<Database>> {
  const status = getSupabaseClientStatus();
  if (!status.configured) {
    return fail("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase is not configured.", "DATA_SOURCE_NOT_CONFIGURED");
  }
  const client = getSupabaseClient();
  if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase client unavailable.", "DATA_SOURCE_NOT_CONFIGURED");
  return { ok: true, data: client };
}

export type ListPublisherLiveNowInput = Readonly<{
  limit?: number;
  cursor?: LiveScreenShareCursor | null;
  search?: string | null;
  category?: string | null;
  language?: string | null;
  followingOnly?: boolean;
  sort?: PublisherLiveNowSort;
}>;

async function listPublisherLiveNow(input: ListPublisherLiveNowInput = {}): Promise<PublisherLiveNowResult<PublisherLiveNowPage>> {
  const configured = getClient();
  if (!configured.ok) return configured;

  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 24), 1), 50);
  const listArgs = {
    p_limit: limit,
    p_cursor_started_at: input.cursor?.startedAt ?? null,
    p_cursor_id: input.cursor?.id ?? null,
    p_search: input.search?.trim() || null,
    p_category: input.category?.trim() || null,
    p_language: input.language?.trim() || null,
    p_following_only: Boolean(input.followingOnly),
    p_sort: input.sort ?? "viewers",
  };
  const countArgs = {
    p_search: listArgs.p_search,
    p_category: listArgs.p_category,
    p_language: listArgs.p_language,
    p_following_only: listArgs.p_following_only,
  };

  const [listResult, countResult] = await Promise.all([
    rpc(configured.data, "list_publisher_live_now", listArgs),
    rpc(configured.data, "count_publisher_live_now", countArgs),
  ]);

  if (listResult.error) return mapFailure(listResult.error);
  if (countResult.error) return mapFailure(countResult.error);

  const rows = (Array.isArray(listResult.data) ? listResult.data : []) as LiveNowRow[];
  const items = rows.map(mapRow);
  const last = rows[rows.length - 1];
  const nextCursor: LiveScreenShareCursor | null =
    rows.length >= limit && last ? { startedAt: last.started_at, id: last.id } : null;

  return {
    ok: true,
    data: {
      items,
      nextCursor,
      totalCount: Number(countResult.data ?? 0),
    },
  };
}

async function listUpcomingSchedules(limit = 12): Promise<PublisherLiveNowResult<readonly UpcomingPublisherSchedule[]>> {
  const configured = getClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "list_upcoming_publisher_schedules", {
    p_limit: Math.min(Math.max(limit, 1), 40),
  });
  if (error) return mapFailure(error);

  const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
  return {
    ok: true,
    data: rows.map((row) => ({
      id: String(row.id),
      publisherUserId: String(row.publisher_user_id),
      title: String(row.title ?? ""),
      category: String(row.category ?? ""),
      languageCode: String(row.language_code ?? ""),
      scheduledStartAt: String(row.scheduled_start_at),
      timezone: String(row.timezone ?? "UTC"),
      publisherDisplayName: String(row.publisher_display_name ?? ""),
      publisherUsername: String(row.publisher_username ?? ""),
      publisherAvatarUrl: row.publisher_avatar_url ? String(row.publisher_avatar_url) : null,
      publisherBadgeType: row.publisher_badge_type ? String(row.publisher_badge_type) : null,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    })),
  };
}

async function listCategoryCounts(): Promise<PublisherLiveNowResult<readonly PublisherLiveCategoryCount[]>> {
  const configured = getClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "count_publisher_live_now_by_category", {});
  if (error) return mapFailure(error);

  const rows = (Array.isArray(data) ? data : []) as Array<{ category: string; live_count: number }>;
  return {
    ok: true,
    data: rows.map((row) => ({
      category: String(row.category ?? "other"),
      liveCount: Number(row.live_count ?? 0),
    })),
  };
}

/**
 * Reloads Live Now when sessions or publisher badges change (suspend/revoke removes cards).
 */
function subscribeToPublisherLiveNow(onChange: () => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => undefined;

  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channel: RealtimeChannel = client
    .channel(`publisher-live-now:${id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "community_live_screen_sessions" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "publisher_badges" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "publisher_profiles" }, onChange)
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export type PublisherScheduleReminderState = Readonly<{
  scheduleId: string;
  enabled: boolean;
  minutesBefore: number;
  scheduledAt: string | null;
  deliveryStatus: string;
}>;

async function listMyScheduleReminders(): Promise<
  PublisherLiveNowResult<readonly PublisherScheduleReminderState[]>
> {
  const configured = getClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "list_my_publisher_stream_schedule_reminders", {});
  if (error) return mapFailure(error);

  const rows = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
  return {
    ok: true,
    data: rows.map((row) => ({
      scheduleId: String(row.schedule_id),
      enabled: Boolean(row.enabled),
      minutesBefore: Number(row.minutes_before ?? 30),
      scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
      deliveryStatus: String(row.delivery_status ?? "pending"),
    })),
  };
}

async function setScheduleReminder(
  scheduleId: string,
  enabled: boolean,
  minutesBefore = 30,
): Promise<PublisherLiveNowResult<PublisherScheduleReminderState>> {
  const configured = getClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "set_publisher_stream_schedule_reminder", {
    target_schedule_id: scheduleId,
    target_enabled: enabled,
    target_minutes_before: minutesBefore,
    target_channel: "app",
  });
  if (error || !data) return mapFailure(error ?? { message: "REMINDER_SAVE_FAILED" });

  const row = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      scheduleId: String(row.schedule_id ?? scheduleId),
      enabled: Boolean(row.enabled),
      minutesBefore: Number(row.minutes_before ?? minutesBefore),
      scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
      deliveryStatus: String(row.delivery_status ?? (enabled ? "pending" : "cancelled")),
    },
  };
}

export const publisherLiveNowService = {
  listPublisherLiveNow,
  listUpcomingSchedules,
  listCategoryCounts,
  listMyScheduleReminders,
  setScheduleReminder,
  subscribeToPublisherLiveNow,
};
