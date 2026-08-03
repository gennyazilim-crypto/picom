import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { LiveScreenShareCategory } from "../../types/liveScreenShare";
import { getSupabaseClient } from "../supabase/supabaseClient";
import type { Database } from "../supabase/database.types";
import {
  type BroadcasterLiveHero,
  type BroadcasterScheduleItem,
  type LiveBroadcastNotificationMode,
  normalizeLiveBroadcastNotificationMode,
  sanitizeChannelRules,
  sanitizeSocialLinks,
} from "../../components/live/broadcasterChannelModel";

type ServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: string }>;

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

function clientOrNull() {
  return getSupabaseClient();
}

function rpc(client: SupabaseClient<Database>, fn: string, args: Record<string, unknown> = {}) {
  return (client as unknown as RpcClient).rpc(fn, args);
}

function tables(client: SupabaseClient<Database>): SupabaseClient {
  return client as unknown as SupabaseClient;
}

function mapLiveRow(row: Record<string, unknown>): BroadcasterLiveHero {
  return {
    sessionId: String(row.id ?? ""),
    title: String(row.title ?? "Live stream"),
    category: String(row.category ?? "other") as LiveScreenShareCategory,
    status: String(row.status ?? "live"),
    startedAt: String(row.started_at ?? new Date().toISOString()),
    viewerCount: Number(row.viewer_count ?? 0),
    communityId: String(row.community_id ?? ""),
    channelId: String(row.channel_id ?? ""),
    communityName: String(row.community_name ?? "Community"),
    channelName: String(row.channel_name ?? "channel"),
    languageCode: String(row.language_code ?? "en"),
  };
}

function mapScheduleRow(row: Record<string, unknown>): BroadcasterScheduleItem {
  const startsAt = String(row.starts_at ?? "");
  const endsAt = row.ends_at ? String(row.ends_at) : null;
  const estimatedFromMeta = row.estimated_duration_minutes != null ? Number(row.estimated_duration_minutes) : null;
  let estimatedDurationMinutes = Number.isFinite(estimatedFromMeta) ? estimatedFromMeta : null;
  if (estimatedDurationMinutes == null && startsAt && endsAt) {
    const mins = Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000);
    estimatedDurationMinutes = Number.isFinite(mins) && mins > 0 ? mins : null;
  }
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    category: String(row.category ?? "livestream"),
    startsAt,
    endsAt,
    timezone: String(row.timezone ?? "UTC"),
    status: String(row.status ?? "published"),
    visibility: String(row.visibility ?? "public"),
    communityId: row.community_id ? String(row.community_id) : null,
    channelId: row.channel_id ? String(row.channel_id) : null,
    communityName: row.community_name ? String(row.community_name) : null,
    liveSessionId: row.live_session_id ? String(row.live_session_id) : null,
    estimatedDurationMinutes,
    reminderSet: Boolean(row.reminder_set),
  };
}

export async function resolveProfileUsername(username: string): Promise<ServiceResult<string>> {
  const client = clientOrNull();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await rpc(client, "resolve_profile_username", { target_username: username });
  if (error || !data) {
    if (error?.message?.includes("PROFILE_NOT_FOUND")) return { ok: false, error: "Profile not found." };
    if (error?.message?.includes("PROFILE_NOT_VISIBLE") || error?.code === "42501") {
      return { ok: false, error: "This profile is not available." };
    }
    return { ok: false, error: error?.message || "Could not resolve username." };
  }
  return { ok: true, data: String(data) };
}

export async function getVisibleLiveForBroadcaster(
  broadcasterUserId: string,
): Promise<ServiceResult<BroadcasterLiveHero | null>> {
  const client = clientOrNull();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await rpc(client, "get_visible_live_session_for_broadcaster", {
    target_broadcaster_id: broadcasterUserId,
  });
  if (error) return { ok: false, error: error.message || "Could not load live status." };
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (!rows.length) return { ok: true, data: null };
  return { ok: true, data: mapLiveRow(rows[0] as Record<string, unknown>) };
}

export async function listVisibleBroadcasterSchedule(
  broadcasterUserId: string,
  limit = 20,
): Promise<ServiceResult<BroadcasterScheduleItem[]>> {
  const client = clientOrNull();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await rpc(client, "list_visible_broadcaster_live_schedule", {
    target_broadcaster_id: broadcasterUserId,
    target_limit: limit,
  });
  if (error) return { ok: false, error: error.message || "Could not load schedule." };
  const rows = Array.isArray(data) ? data : [];
  return { ok: true, data: rows.map((row) => mapScheduleRow(row as Record<string, unknown>)) };
}

export async function upsertOwnLiveSchedule(input: {
  eventId?: string | null;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string | null;
  timezone: string;
  category?: string;
  visibility?: string;
  communityId?: string | null;
  channelId?: string | null;
}): Promise<ServiceResult<BroadcasterScheduleItem>> {
  const client = clientOrNull();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await rpc(client, "upsert_own_live_schedule", {
    target_event_id: input.eventId ?? null,
    target_title: input.title,
    target_description: input.description ?? "",
    target_starts_at: input.startsAt,
    target_ends_at: input.endsAt ?? null,
    target_timezone: input.timezone,
    target_category: input.category ?? "livestream",
    target_visibility: input.visibility ?? "public",
    target_community_id: input.communityId ?? null,
    target_channel_id: input.channelId ?? null,
  });
  if (error || !data) {
    if (error?.code === "42501") return { ok: false, error: "You cannot edit this schedule." };
    if (/LIVE_SCHEDULE_START_PAST/i.test(error?.message ?? "")) {
      return { ok: false, error: "Start time cannot be in the past." };
    }
    if (/LIVE_SCHEDULE_DURATION_INVALID/i.test(error?.message ?? "")) {
      return { ok: false, error: "Estimated duration is outside allowed limits." };
    }
    if (/LIVE_SCHEDULE_COMMUNITY_REQUIRED/i.test(error?.message ?? "")) {
      return { ok: false, error: "Community is required for this visibility." };
    }
    return { ok: false, error: error?.message || "Could not save schedule." };
  }
  return { ok: true, data: mapScheduleRow(data as Record<string, unknown>) };
}

export async function cancelOwnLiveSchedule(eventId: string): Promise<ServiceResult<void>> {
  const client = clientOrNull();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await rpc(client, "cancel_own_live_schedule", { target_event_id: eventId });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "You cannot cancel this schedule." };
    return { ok: false, error: error.message || "Could not cancel schedule." };
  }
  return { ok: true, data: undefined };
}

export async function setScheduleReminder(eventId: string, enabled: boolean): Promise<ServiceResult<void>> {
  const client = clientOrNull();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  if (enabled) {
    const { error } = await rpc(client, "schedule_event_reminders", {
      target_event_id: eventId,
      minutes_before: 30,
      reminder_channel: "app",
    });
    if (error) return { ok: false, error: error.message || "Could not enable reminder." };
    return { ok: true, data: undefined };
  }
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in required." };
  const { error } = await tables(client)
    .from("community_event_reminders")
    .update({ enabled: false })
    .eq("event_id", eventId)
    .eq("user_id", auth.user.id);
  if (error) return { ok: false, error: error.message || "Could not disable reminder." };
  return { ok: true, data: undefined };
}

export async function getLiveBroadcasterNotificationMode(
  broadcasterUserId: string,
): Promise<ServiceResult<LiveBroadcastNotificationMode>> {
  const client = clientOrNull();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in required." };
  const { data, error } = await tables(client)
    .from("live_broadcaster_notification_prefs")
    .select("mode")
    .eq("viewer_user_id", auth.user.id)
    .eq("broadcaster_user_id", broadcasterUserId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message || "Could not load notification preference." };
  return { ok: true, data: normalizeLiveBroadcastNotificationMode((data as { mode?: string } | null)?.mode) };
}

export async function setLiveBroadcasterNotificationMode(
  broadcasterUserId: string,
  mode: LiveBroadcastNotificationMode,
): Promise<ServiceResult<LiveBroadcastNotificationMode>> {
  const client = clientOrNull();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await rpc(client, "upsert_live_broadcaster_notification_pref", {
    target_broadcaster_id: broadcasterUserId,
    target_mode: mode,
  });
  if (error || !data) {
    if (error?.code === "42501") return { ok: false, error: "Notification preference denied." };
    return { ok: false, error: error?.message || "Could not save notification preference." };
  }
  const next = normalizeLiveBroadcastNotificationMode((data as { mode?: string }).mode ?? mode);
  return { ok: true, data: next };
}

export async function loadChannelExtras(userId: string): Promise<ServiceResult<{
  channelRules: string;
  primaryLiveCategories: string[];
  socialLinks: ReturnType<typeof sanitizeSocialLinks>;
}>> {
  const client = clientOrNull();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await tables(client)
    .from("profile_details")
    .select("channel_rules, primary_live_categories, social_links")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message || "Could not load channel details." };
  const row = data as {
    channel_rules?: string | null;
    primary_live_categories?: string[] | null;
    social_links?: unknown;
  } | null;
  return {
    ok: true,
    data: {
      channelRules: sanitizeChannelRules(String(row?.channel_rules ?? "")),
      primaryLiveCategories: Array.isArray(row?.primary_live_categories)
        ? row.primary_live_categories.map(String).slice(0, 8)
        : [],
      socialLinks: sanitizeSocialLinks(row?.social_links),
    },
  };
}

export function subscribeBroadcasterLiveSession(
  broadcasterUserId: string,
  onChange: () => void,
): () => void {
  const client = clientOrNull();
  if (!client || !broadcasterUserId) return () => undefined;
  const channel: RealtimeChannel = client
    .channel(`broadcaster-live:${broadcasterUserId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "community_live_screen_sessions",
        filter: `broadcaster_user_id=eq.${broadcasterUserId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeBroadcasterSchedule(
  broadcasterUserId: string,
  onChange: () => void,
): () => void {
  const client = clientOrNull();
  if (!client || !broadcasterUserId) return () => undefined;
  const channel: RealtimeChannel = client
    .channel(`broadcaster-schedule:${broadcasterUserId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "community_events",
        filter: `created_by=eq.${broadcasterUserId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

export const broadcasterChannelService = {
  resolveProfileUsername,
  getVisibleLiveForBroadcaster,
  listVisibleBroadcasterSchedule,
  upsertOwnLiveSchedule,
  cancelOwnLiveSchedule,
  setScheduleReminder,
  getLiveBroadcasterNotificationMode,
  setLiveBroadcasterNotificationMode,
  loadChannelExtras,
  subscribeBroadcasterLiveSession,
  subscribeBroadcasterSchedule,
};
