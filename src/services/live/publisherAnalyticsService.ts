import { getSupabaseClient } from "../supabase/supabaseClient";
import { featureFlagService } from "../featureFlagService";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

function rpc(client: NonNullable<ReturnType<typeof getSupabaseClient>>, fn: string, args: Record<string, unknown> = {}) {
  return (client as unknown as RpcClient).rpc(fn, args);
}

export type PublisherAnalyticsOverview = Readonly<{
  rangeDays: number;
  streamCount: number;
  uniqueViewers: number;
  viewerSessions: number;
  peakConcurrent: number;
  totalWatchSeconds: number;
  avgWatchSeconds: number | null;
  followersGained: number;
  chatMessages: number;
  reactions: number;
  notificationJoins: number;
  streams: ReadonlyArray<{
    streamId: string;
    startedAt: string | null;
    endedAt: string | null;
    uniqueViewers: number;
    peakConcurrent: number;
    totalWatchSeconds: number;
    chatMessages: number;
    followersGained: number;
    finalized: boolean;
  }>;
}>;

export type PublisherStreamAnalytics = Readonly<{
  streamId: string;
  uniqueViewers: number;
  viewerSessions: number;
  peakConcurrent: number;
  currentConcurrent: number;
  totalWatchSeconds: number;
  avgWatchSeconds: number | null;
  chatMessages: number;
  reactions: number;
  moderationActions: number;
  followersGained: number;
  notificationJoins: number;
  reconnectCount: number;
  healthSampleCount: number | null;
  finalized: boolean;
  startedAt: string | null;
  endedAt: string | null;
}>;

type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

function gate(): Result<never> | null {
  if (!featureFlagService.isEnabled("enablePublisherAnalytics")) {
    return { ok: false, code: "FEATURE_DISABLED", message: "Publisher analytics is disabled." };
  }
  return null;
}

function mapOverview(raw: Record<string, unknown>): PublisherAnalyticsOverview {
  const streamsRaw = Array.isArray(raw.streams) ? raw.streams : [];
  return {
    rangeDays: Number(raw.range_days ?? 30),
    streamCount: Number(raw.stream_count ?? 0),
    uniqueViewers: Number(raw.unique_viewers ?? 0),
    viewerSessions: Number(raw.viewer_sessions ?? 0),
    peakConcurrent: Number(raw.peak_concurrent ?? 0),
    totalWatchSeconds: Number(raw.total_watch_seconds ?? 0),
    avgWatchSeconds: raw.avg_watch_seconds == null ? null : Number(raw.avg_watch_seconds),
    followersGained: Number(raw.followers_gained ?? 0),
    chatMessages: Number(raw.chat_messages ?? 0),
    reactions: Number(raw.reactions ?? 0),
    notificationJoins: Number(raw.notification_joins ?? 0),
    streams: streamsRaw.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        streamId: String(row.stream_id ?? ""),
        startedAt: typeof row.started_at === "string" ? row.started_at : null,
        endedAt: typeof row.ended_at === "string" ? row.ended_at : null,
        uniqueViewers: Number(row.unique_viewers ?? 0),
        peakConcurrent: Number(row.peak_concurrent ?? 0),
        totalWatchSeconds: Number(row.total_watch_seconds ?? 0),
        chatMessages: Number(row.chat_messages ?? 0),
        followersGained: Number(row.followers_gained ?? 0),
        finalized: row.finalized === true,
      };
    }),
  };
}

function resolveClientPlatform(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("windows")) return "desktop_windows";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "desktop_macos";
  if (ua.includes("linux")) return "desktop_linux";
  return "web";
}

export const publisherAnalyticsService = {
  async resolveStreamIdForLiveSession(liveSessionId: string): Promise<Result<{ streamId: string | null }>> {
    const blocked = gate();
    if (blocked) return blocked;
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { data, error } = await rpc(client, "resolve_publisher_stream_id_for_live_session", {
      target_live_session_id: liveSessionId,
    });
    if (error) return { ok: false, code: "RPC_FAILED", message: error.message ?? "RPC failed" };
    const streamId = typeof data === "string" && data.length > 0 ? data : null;
    return { ok: true, data: { streamId } };
  },

  async getOverview(rangeDays = 30): Promise<Result<PublisherAnalyticsOverview>> {
    const blocked = gate();
    if (blocked) return blocked;
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { data, error } = await rpc(client, "get_publisher_analytics_overview", { range_days: rangeDays });
    if (error) return { ok: false, code: "RPC_FAILED", message: error.message ?? "RPC failed" };
    return { ok: true, data: mapOverview((data ?? {}) as Record<string, unknown>) };
  },

  async getStreamAnalytics(streamId: string): Promise<Result<PublisherStreamAnalytics>> {
    const blocked = gate();
    if (blocked) return blocked;
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { data, error } = await rpc(client, "get_publisher_stream_analytics", {
      target_stream_id: streamId,
      include_internal: false,
    });
    if (error) return { ok: false, code: "RPC_FAILED", message: error.message ?? "RPC failed" };
    const row = (data ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      data: {
        streamId: String(row.stream_id ?? streamId),
        uniqueViewers: Number(row.unique_viewers ?? 0),
        viewerSessions: Number(row.viewer_sessions ?? 0),
        peakConcurrent: Number(row.peak_concurrent ?? 0),
        currentConcurrent: Number(row.current_concurrent ?? 0),
        totalWatchSeconds: Number(row.total_watch_seconds ?? 0),
        avgWatchSeconds: row.avg_watch_seconds == null ? null : Number(row.avg_watch_seconds),
        chatMessages: Number(row.chat_messages ?? 0),
        reactions: Number(row.reactions ?? 0),
        moderationActions: Number(row.moderation_actions ?? 0),
        followersGained: Number(row.followers_gained ?? 0),
        notificationJoins: Number(row.notification_joins ?? 0),
        reconnectCount: Number(row.reconnect_count ?? 0),
        healthSampleCount: row.health_sample_count == null ? null : Number(row.health_sample_count),
        finalized: row.finalized === true,
        startedAt: typeof row.started_at === "string" ? row.started_at : null,
        endedAt: typeof row.ended_at === "string" ? row.ended_at : null,
      },
    };
  },

  async joinViewerSession(input: {
    streamId: string;
    clientPlatform?: string;
    locale?: string;
    source?: string;
    notificationDeliveryId?: string | null;
  }): Promise<Result<{ sessionId: string }>> {
    const blocked = gate();
    if (blocked) return blocked;
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { data, error } = await rpc(client, "join_publisher_stream_viewer_session", {
      target_stream_id: input.streamId,
      client_platform: input.clientPlatform ?? resolveClientPlatform(),
      locale: input.locale ?? null,
      source_allowlist: input.source ?? "other",
      notification_delivery_id: input.notificationDeliveryId ?? null,
      idempotency_key: null,
    });
    if (error) return { ok: false, code: "RPC_FAILED", message: error.message ?? "RPC failed" };
    const row = data as Record<string, unknown> | null;
    const sessionId = typeof row?.id === "string" ? row.id : "";
    if (!sessionId) return { ok: false, code: "RPC_FAILED", message: "Missing session id." };
    return { ok: true, data: { sessionId } };
  },

  async heartbeat(sessionId: string): Promise<Result<true>> {
    const blocked = gate();
    if (blocked) return blocked;
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { error } = await rpc(client, "record_publisher_viewer_heartbeat", {
      target_session_id: sessionId,
      idempotency_key: null,
    });
    if (error) return { ok: false, code: "RPC_FAILED", message: error.message ?? "RPC failed" };
    return { ok: true, data: true };
  },

  async leave(sessionId: string): Promise<Result<true>> {
    const blocked = gate();
    if (blocked) return blocked;
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { error } = await rpc(client, "leave_publisher_stream_viewer_session", {
      target_session_id: sessionId,
      idempotency_key: null,
    });
    if (error) return { ok: false, code: "RPC_FAILED", message: error.message ?? "RPC failed" };
    return { ok: true, data: true };
  },
};

export function formatWatchDuration(totalSeconds: number | null | undefined, locale: string): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "—";
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return new Intl.NumberFormat(locale).format(h) + "h " + m + "m";
  if (m > 0) return new Intl.NumberFormat(locale).format(m) + "m " + s + "s";
  return new Intl.NumberFormat(locale).format(s) + "s";
}
