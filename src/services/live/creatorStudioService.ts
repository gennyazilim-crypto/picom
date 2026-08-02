import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import { loggingService } from "../loggingService";
import type { LiveScreenShareCategory } from "../../types/liveScreenShare";
import type {
  CreatorStudioActivityEvent,
  CreatorStudioChatMode,
  CreatorStudioSession,
  CreatorStudioSummary,
  CreatorStudioViewerRow,
} from "../../components/live/creatorStudioModel";

export type CreatorStudioServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "LIVE_FORBIDDEN"
  | "LIVE_NOT_FOUND"
  | "LIVE_ENDED"
  | "VALIDATION_ERROR"
  | "LIVE_UPDATE_FAILED"
  | "UNKNOWN_ERROR";

export type CreatorStudioServiceError = Readonly<{ code: CreatorStudioServiceErrorCode; message: string }>;
export type CreatorStudioResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: CreatorStudioServiceError }>;

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

function fail(code: CreatorStudioServiceErrorCode, message: string): CreatorStudioResult<never> {
  return { ok: false, error: { code, message } };
}

function clientConfigured() {
  const status = getSupabaseClientStatus();
  if (!status.configured) return fail("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase is not configured.");
  const client = getSupabaseClient();
  if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase client unavailable.");
  return { ok: true as const, data: client };
}

function rpc(client: NonNullable<ReturnType<typeof getSupabaseClient>>, fn: string, args: Record<string, unknown> = {}) {
  return (client as unknown as RpcClient).rpc(fn, args);
}

function mapError(error: unknown, fallback: CreatorStudioServiceErrorCode, message: string): CreatorStudioResult<never> {
  const text = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error ?? "");
  if (/AUTH_REQUIRED|JWT/i.test(text)) return fail("AUTH_REQUIRED", "Sign in to open Creator Studio.");
  if (/LIVE_FORBIDDEN|42501/i.test(text)) return fail("LIVE_FORBIDDEN", "You do not have access to this Creator Studio.");
  if (/LIVE_NOT_FOUND|P0002/i.test(text)) return fail("LIVE_NOT_FOUND", "Broadcast session was not found.");
  if (/LIVE_ENDED/i.test(text)) return fail("LIVE_ENDED", "This broadcast has already ended.");
  if (/VALIDATION/i.test(text)) return fail("VALIDATION_ERROR", "Invalid studio update.");
  loggingService.logWarn("Creator Studio RPC failed", { fallback, text: text.slice(0, 240) }, "live");
  return fail(fallback, message);
}

type StudioRow = Readonly<{
  session_id: string;
  community_id: string;
  channel_id: string;
  broadcaster_user_id: string;
  livekit_room_name: string;
  title: string;
  description: string;
  category: string;
  application_name: string;
  language_code: string;
  visibility_mode: string;
  chat_mode: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  viewer_count: number;
  peak_concurrent_viewers: number;
  unique_viewer_count: number;
  reconnect_count: number;
  participant_count: number;
  community_name: string;
  channel_name: string;
  is_owner: boolean;
  can_moderate: boolean;
}>;

function mapCategory(value: string): LiveScreenShareCategory {
  return (["game", "chat", "education", "watch_together", "other"] as const).includes(value as LiveScreenShareCategory)
    ? (value as LiveScreenShareCategory)
    : "other";
}

function mapChatMode(value: string): CreatorStudioChatMode {
  return value === "subscribers" || value === "disabled" ? value : "everyone";
}

function mapSession(row: StudioRow): CreatorStudioSession {
  return {
    id: row.session_id,
    communityId: row.community_id,
    channelId: row.channel_id,
    broadcasterUserId: row.broadcaster_user_id,
    livekitRoomName: row.livekit_room_name,
    title: row.title,
    description: row.description ?? "",
    category: mapCategory(row.category),
    applicationName: row.application_name ?? "",
    languageCode: row.language_code ?? "",
    visibilityMode: row.visibility_mode ?? "channel_members",
    chatMode: mapChatMode(row.chat_mode),
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    viewerCount: Number(row.viewer_count ?? 0),
    peakConcurrentViewers: Number(row.peak_concurrent_viewers ?? 0),
    uniqueViewerCount: Number(row.unique_viewer_count ?? 0),
    reconnectCount: Number(row.reconnect_count ?? 0),
    participantCount: Number(row.participant_count ?? 0),
    communityName: row.community_name ?? "",
    channelName: row.channel_name ?? "",
    isOwner: Boolean(row.is_owner),
    canModerate: Boolean(row.can_moderate),
  };
}

export type UpdateStudioMetadataInput = Readonly<{
  title?: string;
  description?: string;
  category?: LiveScreenShareCategory;
  applicationName?: string;
  languageCode?: string;
  chatMode?: CreatorStudioChatMode;
}>;

export const creatorStudioService = {
  async authorizeStudio(sessionId: string): Promise<CreatorStudioResult<CreatorStudioSession>> {
    const configured = clientConfigured();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "authorize_creator_studio_access", {
      target_session_id: sessionId,
    });
    if (error) return mapError(error, "LIVE_FORBIDDEN", "Could not open Creator Studio.");
    const row = Array.isArray(data) ? (data[0] as StudioRow | undefined) : (data as StudioRow | null);
    if (!row) return fail("LIVE_NOT_FOUND", "Broadcast session was not found.");
    return { ok: true, data: mapSession(row) };
  },

  async updateMetadata(sessionId: string, input: UpdateStudioMetadataInput): Promise<CreatorStudioResult<CreatorStudioSession>> {
    const configured = clientConfigured();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "update_community_live_screen_broadcast_metadata", {
      target_session_id: sessionId,
      target_title: input.title ?? null,
      target_description: input.description ?? null,
      target_category: input.category ?? null,
      target_application_name: input.applicationName ?? null,
      target_language_code: input.languageCode ?? null,
      target_chat_mode: input.chatMode ?? null,
    });
    if (error || !data) return mapError(error, "LIVE_UPDATE_FAILED", "Could not update broadcast metadata.");

    const row = data as {
      id: string;
      community_id: string;
      channel_id: string;
      broadcaster_user_id: string;
      livekit_room_name: string;
      title: string;
      description: string | null;
      category: string;
      application_name: string | null;
      language_code: string | null;
      visibility_mode: string | null;
      chat_mode: string | null;
      status: string;
      started_at: string;
      ended_at: string | null;
      viewer_count: number;
      peak_concurrent_viewers: number;
      unique_viewer_count: number;
      reconnect_count: number;
      participant_count: number;
    };

    // Owner-only RPC already enforced server-side; avoid a second authorize round-trip.
    return {
      ok: true,
      data: {
        id: row.id,
        communityId: row.community_id,
        channelId: row.channel_id,
        broadcasterUserId: row.broadcaster_user_id,
        livekitRoomName: row.livekit_room_name,
        title: row.title,
        description: row.description ?? "",
        category: mapCategory(row.category),
        applicationName: row.application_name ?? "",
        languageCode: row.language_code ?? "",
        visibilityMode: row.visibility_mode ?? "channel_members",
        chatMode: mapChatMode(row.chat_mode ?? "everyone"),
        status: row.status,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        viewerCount: Number(row.viewer_count ?? 0),
        peakConcurrentViewers: Number(row.peak_concurrent_viewers ?? 0),
        uniqueViewerCount: Number(row.unique_viewer_count ?? 0),
        reconnectCount: Number(row.reconnect_count ?? 0),
        participantCount: Number(row.participant_count ?? 0),
        communityName: "",
        channelName: "",
        isOwner: true,
        canModerate: false,
      },
    };
  },

  async listViewers(sessionId: string): Promise<CreatorStudioResult<readonly CreatorStudioViewerRow[]>> {
    const configured = clientConfigured();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "list_creator_studio_viewers", {
      target_session_id: sessionId,
    });
    if (error) return mapError(error, "LIVE_FORBIDDEN", "Could not load viewers.");
    const rows = Array.isArray(data) ? data : [];
    return {
      ok: true,
      data: rows.map((row) => {
        const item = row as {
          viewer_user_id: string;
          display_name: string;
          username: string;
          joined_at: string;
          last_seen_at: string;
        };
        return {
          viewerUserId: item.viewer_user_id,
          displayName: item.display_name || "",
          username: item.username || "",
          joinedAt: item.joined_at,
          lastSeenAt: item.last_seen_at,
        };
      }),
    };
  },

  async listActivity(sessionId: string, limit = 50): Promise<CreatorStudioResult<readonly CreatorStudioActivityEvent[]>> {
    const configured = clientConfigured();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "list_creator_studio_activity", {
      target_session_id: sessionId,
      target_limit: limit,
    });
    if (error) return mapError(error, "LIVE_FORBIDDEN", "Could not load activity.");
    const rows = Array.isArray(data) ? data : [];
    return {
      ok: true,
      data: rows.map((row) => {
        const item = row as {
          id: string;
          event_type: string;
          actor_user_id: string | null;
          actor_display_name: string;
          safe_metadata: Record<string, unknown> | null;
          created_at: string;
        };
        return {
          id: item.id,
          eventType: item.event_type,
          actorUserId: item.actor_user_id,
          actorDisplayName: item.actor_display_name || "",
          safeMetadata: item.safe_metadata && typeof item.safe_metadata === "object" ? item.safe_metadata : {},
          createdAt: item.created_at,
        };
      }),
    };
  },

  async bumpReconnect(sessionId: string): Promise<CreatorStudioResult<true>> {
    const configured = clientConfigured();
    if (!configured.ok) return configured;
    const { error } = await rpc(configured.data, "bump_live_screen_reconnect_count", {
      target_session_id: sessionId,
    });
    if (error) return mapError(error, "LIVE_UPDATE_FAILED", "Could not record reconnect.");
    return { ok: true, data: true };
  },

  async getSummary(sessionId: string): Promise<CreatorStudioResult<CreatorStudioSummary>> {
    const configured = clientConfigured();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "get_creator_studio_summary", {
      target_session_id: sessionId,
    });
    if (error) return mapError(error, "LIVE_FORBIDDEN", "Could not load studio summary.");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") return fail("LIVE_NOT_FOUND", "Summary unavailable.");
    const item = row as {
      session_id: string;
      title: string;
      status: string;
      started_at: string;
      ended_at: string | null;
      duration_seconds: number;
      peak_concurrent_viewers: number;
      unique_viewer_count: number;
      chat_message_count: number;
      reconnect_count: number;
    };
    return {
      ok: true,
      data: {
        sessionId: item.session_id,
        title: item.title,
        status: item.status,
        startedAt: item.started_at,
        endedAt: item.ended_at,
        durationSeconds: Number(item.duration_seconds ?? 0),
        peakConcurrentViewers: Number(item.peak_concurrent_viewers ?? 0),
        uniqueViewerCount: Number(item.unique_viewer_count ?? 0),
        chatMessageCount: Number(item.chat_message_count ?? 0),
        reconnectCount: Number(item.reconnect_count ?? 0),
      },
    };
  },
};
