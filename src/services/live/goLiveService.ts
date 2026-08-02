import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import type { LiveScreenShareCategory, LiveScreenShareSummary } from "../../types/liveScreenShare";
import type { GoLiveVisibilityMode } from "../../components/live/goLiveModel";
import { loggingService } from "../loggingService";

export type GoLiveTarget = Readonly<{
  communityId: string;
  communityName: string;
  communityKind: string;
  communityVisibility: string;
  channelId: string;
  channelName: string;
  channelPrivate: boolean;
  canPublishScreen: boolean;
  canPublishAudio: boolean;
}>;

export type GoLiveServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "LIVE_FORBIDDEN"
  | "LIVE_SHARE_CONFLICT"
  | "LIVE_CHANNEL_INVALID"
  | "LIVE_NOT_FOUND"
  | "LIVE_START_FAILED"
  | "LIVE_CONFIRM_FAILED"
  | "LIVE_ABORT_FAILED"
  | "UNKNOWN_ERROR";

export type GoLiveServiceError = Readonly<{ code: GoLiveServiceErrorCode; message: string }>;
export type GoLiveResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: GoLiveServiceError }>;

type LiveRpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string; details?: string; hint?: string } | null }>;
};

function rpc(client: ReturnType<typeof getSupabaseClient>, fn: string, args: Record<string, unknown> = {}) {
  return (client as unknown as LiveRpcClient).rpc(fn, args);
}

function fail(code: GoLiveServiceErrorCode, message: string): GoLiveResult<never> {
  return { ok: false, error: { code, message } };
}

function blob(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const candidate = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  return [candidate.message, candidate.code, candidate.details, candidate.hint].filter(Boolean).map(String).join(" ");
}

function mapError(error: unknown, fallback: GoLiveServiceErrorCode, message: string): GoLiveResult<never> {
  const text = blob(error);
  if (/AUTH_REQUIRED|JWT|not authenticated/i.test(text)) return fail("AUTH_REQUIRED", "Sign in to go live.");
  if (/LIVE_FORBIDDEN|42501/i.test(text)) return fail("LIVE_FORBIDDEN", "You do not have permission to broadcast here.");
  if (/LIVE_SHARE_CONFLICT|23505/i.test(text)) return fail("LIVE_SHARE_CONFLICT", "Another active broadcast is already running.");
  if (/LIVE_CHANNEL_INVALID|22023|VALIDATION/i.test(text)) return fail("LIVE_CHANNEL_INVALID", "Community or channel is invalid for broadcasting.");
  if (/LIVE_NOT_FOUND|P0002/i.test(text)) return fail("LIVE_NOT_FOUND", "Broadcast session was not found.");
  loggingService.logWarn("Go Live RPC failed", { fallback, text: text.slice(0, 240) }, "live");
  return fail(fallback, message);
}

function clientConfigured() {
  const status = getSupabaseClientStatus();
  if (!status.configured) return fail("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase is not configured.");
  const client = getSupabaseClient();
  if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase client unavailable.");
  return { ok: true as const, data: client as NonNullable<ReturnType<typeof getSupabaseClient>> & { /* typed */ } };
}

type TargetRow = Readonly<{
  community_id: string;
  community_name: string;
  community_kind: string;
  community_visibility: string;
  channel_id: string;
  channel_name: string;
  channel_private: boolean;
  can_publish_screen: boolean;
  can_publish_audio: boolean;
}>;

type SessionRow = Readonly<{
  id: string;
  livekit_room_name: string;
  community_id: string;
  channel_id: string;
  broadcaster_user_id: string;
  title: string;
  category: string;
  application_name: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  viewer_count: number;
  participant_count: number;
  preview_updated_at: string | null;
}>;

function mapSession(row: SessionRow): LiveScreenShareSummary {
  const category = (["game", "chat", "education", "watch_together", "other"] as const).includes(row.category as LiveScreenShareCategory)
    ? (row.category as LiveScreenShareCategory)
    : "other";
  return {
    id: row.id,
    livekitRoomName: row.livekit_room_name,
    communityId: row.community_id,
    channelId: row.channel_id,
    broadcasterUserId: row.broadcaster_user_id,
    title: row.title,
    category,
    applicationName: row.application_name,
    status: (["starting", "live", "reconnecting", "ended", "terminated"] as const).includes(row.status as never)
      ? (row.status as LiveScreenShareSummary["status"])
      : "ended",
    startedAt: row.started_at,
    endedAt: row.ended_at,
    viewerCount: row.viewer_count,
    participantCount: row.participant_count,
    previewUpdatedAt: row.preview_updated_at,
    communityName: "",
    channelName: "",
    broadcasterDisplayName: "",
    broadcasterUsername: "",
    friendViewerIds: [],
    relevanceScore: 0,
  };
}

export type StartBroadcastInput = Readonly<{
  communityId: string;
  channelId: string;
  clientRequestId: string;
  title: string;
  category?: LiveScreenShareCategory;
  applicationName?: string;
  description?: string;
  languageCode?: string;
  visibilityMode?: GoLiveVisibilityMode;
  scheduleEventId?: string | null;
}>;

export const goLiveService = {
  async listBroadcastTargets(): Promise<GoLiveResult<readonly GoLiveTarget[]>> {
    const configured = clientConfigured();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "list_go_live_broadcast_targets");
    if (error) return mapError(error, "LIVE_START_FAILED", "Could not load broadcast targets.");
    const rows = Array.isArray(data) ? (data as TargetRow[]) : [];
    return {
      ok: true,
      data: rows.map((row) => ({
        communityId: row.community_id,
        communityName: row.community_name,
        communityKind: row.community_kind,
        communityVisibility: row.community_visibility,
        channelId: row.channel_id,
        channelName: row.channel_name,
        channelPrivate: Boolean(row.channel_private),
        canPublishScreen: Boolean(row.can_publish_screen),
        canPublishAudio: Boolean(row.can_publish_audio),
      })),
    };
  },

  async startBroadcast(input: StartBroadcastInput): Promise<GoLiveResult<LiveScreenShareSummary>> {
    const configured = clientConfigured();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "start_community_live_screen_broadcast", {
      target_community_id: input.communityId,
      target_channel_id: input.channelId,
      target_client_request_id: input.clientRequestId,
      target_title: input.title,
      target_category: input.category ?? "other",
      target_application_name: input.applicationName ?? "",
      target_description: input.description ?? "",
      target_language_code: input.languageCode ?? "",
      target_visibility_mode: input.visibilityMode ?? "channel_members",
      target_schedule_event_id: input.scheduleEventId ?? null,
    });
    if (error || !data) return mapError(error, "LIVE_START_FAILED", "Could not start the broadcast session.");
    return { ok: true, data: mapSession(data as SessionRow) };
  },

  async confirmBroadcast(sessionId: string): Promise<GoLiveResult<LiveScreenShareSummary>> {
    const configured = clientConfigured();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "confirm_community_live_screen_broadcast", {
      target_session_id: sessionId,
    });
    if (error || !data) return mapError(error, "LIVE_CONFIRM_FAILED", "Could not confirm the live broadcast.");
    return { ok: true, data: mapSession(data as SessionRow) };
  },

  async abortBroadcast(sessionId: string): Promise<GoLiveResult<LiveScreenShareSummary>> {
    const configured = clientConfigured();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "abort_community_live_screen_broadcast", {
      target_session_id: sessionId,
    });
    if (error || !data) return mapError(error, "LIVE_ABORT_FAILED", "Could not abort the broadcast session.");
    return { ok: true, data: mapSession(data as SessionRow) };
  },
};

