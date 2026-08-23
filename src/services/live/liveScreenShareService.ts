import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type {
  LiveScreenShareCategory,
  LiveScreenShareCursor,
  LiveScreenShareFilter,
  LiveScreenShareSort,
  LiveScreenShareStatus,
  LiveScreenShareSummary,
  LiveScreenSharePage,
} from "../../types/liveScreenShare";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import type { Database } from "../supabase/database.types";
import { loggingService } from "../loggingService";

const LIVE_SESSION_SELECT = "id, livekit_room_name, community_id, channel_id, broadcaster_user_id, title, category, application_name, status, started_at, ended_at, viewer_count, participant_count, preview_updated_at" as const;

const LIVE_STATUSES: readonly LiveScreenShareStatus[] = ["starting", "live", "reconnecting", "ended", "terminated"];
const LIVE_CATEGORIES: readonly LiveScreenShareCategory[] = ["game", "chat", "education", "watch_together", "other"];

export type LiveScreenShareErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "LIVE_NOT_FOUND"
  | "LIVE_FORBIDDEN"
  | "LIVE_SHARE_CONFLICT"
  | "LIVE_ROOM_INVALID"
  | "LIVE_CHANNEL_INVALID"
  | "LIVE_LIST_FAILED"
  | "LIVE_UPSERT_FAILED"
  | "LIVE_HEARTBEAT_FAILED"
  | "LIVE_END_FAILED"
  | "LIVE_JOIN_FAILED"
  | "LIVE_LEAVE_FAILED"
  | "LIVE_HIDE_FAILED"
  | "LIVE_REPORT_FAILED"
  | "LIVE_UPDATE_FAILED"
  | "LIVE_MODERATION_FAILED"
  | "UNKNOWN_ERROR";

export type LiveScreenShareServiceError = Readonly<{ code: LiveScreenShareErrorCode; message: string }>;

export type LiveScreenShareResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: LiveScreenShareServiceError }>;

export type ListVisibleLiveSharesInput = Readonly<{
  filter?: LiveScreenShareFilter;
  sort?: LiveScreenShareSort;
  limit?: number;
  cursor?: LiveScreenShareCursor | null;
}>;

export type UpsertLiveShareInput = Readonly<{
  communityId: string;
  channelId: string;
  livekitRoomName: string;
  title?: string;
  category?: LiveScreenShareCategory;
  applicationName?: string;
  participantCount?: number;
}>;

export type HeartbeatLiveShareInput = Readonly<{
  participantCount?: number;
  status?: Extract<LiveScreenShareStatus, "live" | "reconnecting">;
}>;

export type UpdateLiveShareMetadataInput = Readonly<{
  title?: string;
  category?: LiveScreenShareCategory;
  applicationName?: string;
}>;

type LiveScreenSessionRow = Readonly<{
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

type LiveScreenSessionListRow = LiveScreenSessionRow & Readonly<{
  community_name: string | null;
  channel_name: string | null;
  broadcaster_display_name: string | null;
  broadcaster_username: string | null;
  friend_viewer_ids: string[] | null;
  relevance_score: number | string | null;
}>;

type LiveRpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string; details?: string; hint?: string } | null }>;
};

function rpc(client: SupabaseClient<Database>, fn: string, args: Record<string, unknown> = {}) {
  return (client as unknown as LiveRpcClient).rpc(fn, args);
}

/** The new Picom Live tables/RPCs aren't in the generated Database types yet; this widens `.from()`. */
function untypedTables(client: SupabaseClient<Database>): SupabaseClient {
  return client as unknown as SupabaseClient;
}

function liveError(code: LiveScreenShareErrorCode, message: string): LiveScreenShareResult<never> {
  return { ok: false, error: { code, message } };
}

function normalizeStatus(value: string): LiveScreenShareStatus {
  return (LIVE_STATUSES as readonly string[]).includes(value) ? (value as LiveScreenShareStatus) : "ended";
}

function normalizeCategory(value: string): LiveScreenShareCategory {
  return (LIVE_CATEGORIES as readonly string[]).includes(value) ? (value as LiveScreenShareCategory) : "other";
}

function mapSessionRow(row: LiveScreenSessionRow): LiveScreenShareSummary {
  return {
    id: row.id,
    livekitRoomName: row.livekit_room_name,
    communityId: row.community_id,
    channelId: row.channel_id,
    broadcasterUserId: row.broadcaster_user_id,
    title: row.title,
    category: normalizeCategory(row.category),
    applicationName: row.application_name,
    status: normalizeStatus(row.status),
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

function mapListRow(row: LiveScreenSessionListRow): LiveScreenShareSummary {
  return {
    ...mapSessionRow(row),
    communityName: row.community_name ?? "",
    channelName: row.channel_name ?? "",
    broadcasterDisplayName: row.broadcaster_display_name ?? "",
    broadcasterUsername: row.broadcaster_username ?? "",
    friendViewerIds: row.friend_viewer_ids ?? [],
    relevanceScore: Number(row.relevance_score ?? 0),
  };
}

function getConfiguredSupabaseClient(): LiveScreenShareResult<SupabaseClient<Database>> {
  const status = getSupabaseClientStatus();
  if (!status.configured) {
    return liveError("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase data source is not configured.");
  }

  const client = getSupabaseClient();
  if (!client) return liveError("DATA_SOURCE_NOT_CONFIGURED", "Supabase client is unavailable.");

  return { ok: true, data: client };
}

function errorBlob(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const candidate = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  return [candidate.message, candidate.code, candidate.details, candidate.hint]
    .filter((part) => part != null && String(part).trim() !== "")
    .map(String)
    .join(" ");
}

function hasErrorMessage(error: unknown, marker: string): boolean {
  return errorBlob(error).toUpperCase().includes(marker.toUpperCase());
}

function isUniqueViolation(error: unknown): boolean {
  return hasErrorMessage(error, "23505") || hasErrorMessage(error, "duplicate key");
}

function mapRpcFailure(error: unknown, fallbackCode: LiveScreenShareErrorCode, fallbackMessage: string): LiveScreenShareResult<never> {
  if (hasErrorMessage(error, "AUTH_REQUIRED") || hasErrorMessage(error, "JWT") || hasErrorMessage(error, "not authenticated")) {
    return liveError("AUTH_REQUIRED", "Sign in to use Picom Live.");
  }
  if (hasErrorMessage(error, "LIVE_FORBIDDEN") || hasErrorMessage(error, "42501")) {
    return liveError("LIVE_FORBIDDEN", "You do not have permission to do that.");
  }
  if (hasErrorMessage(error, "LIVE_NOT_FOUND") || hasErrorMessage(error, "P0002")) {
    return liveError("LIVE_NOT_FOUND", "This live share is no longer available.");
  }
  if (hasErrorMessage(error, "LIVE_SHARE_CONFLICT") || isUniqueViolation(error)) {
    return liveError("LIVE_SHARE_CONFLICT", "Another broadcast is already live in this channel.");
  }
  if (hasErrorMessage(error, "LIVE_ROOM_INVALID")) {
    return liveError("LIVE_ROOM_INVALID", "That LiveKit room name is invalid.");
  }
  if (hasErrorMessage(error, "LIVE_CHANNEL_INVALID")) {
    return liveError("LIVE_CHANNEL_INVALID", "That voice channel is not available for Picom Live.");
  }
  if (hasErrorMessage(error, "Failed to fetch") || hasErrorMessage(error, "NetworkError") || hasErrorMessage(error, "fetch failed")) {
    return liveError(fallbackCode, "Picom could not reach the Live service. Check your connection and retry.");
  }

  loggingService.logWarn("Picom Live request failed", { diagnostic: errorBlob(error).slice(0, 240) }, "live");
  return liveError(fallbackCode, fallbackMessage);
}

function clampLimit(limit: number | undefined, fallback = 48): number {
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(Math.trunc(limit as number), 1), 100);
}

function validateUpsertInput(input: UpsertLiveShareInput): LiveScreenShareServiceError | null {
  if (!input.communityId?.trim()) return { code: "VALIDATION_ERROR", message: "Community ID is required." };
  if (!input.channelId?.trim()) return { code: "VALIDATION_ERROR", message: "Channel ID is required." };
  if (!input.livekitRoomName?.trim() || input.livekitRoomName.trim().length < 8) {
    return { code: "VALIDATION_ERROR", message: "A valid LiveKit room name is required." };
  }
  if (input.title !== undefined && input.title.length > 160) {
    return { code: "VALIDATION_ERROR", message: "Title must be 160 characters or fewer." };
  }
  if (input.applicationName !== undefined && input.applicationName.length > 120) {
    return { code: "VALIDATION_ERROR", message: "Application name must be 120 characters or fewer." };
  }
  if (input.category !== undefined && !LIVE_CATEGORIES.includes(input.category)) {
    return { code: "VALIDATION_ERROR", message: "Invalid live share category." };
  }
  return null;
}

function requireSessionId(sessionId: string): LiveScreenShareServiceError | null {
  if (!sessionId?.trim()) return { code: "VALIDATION_ERROR", message: "Session ID is required." };
  return null;
}

async function listVisibleLiveShares(input: ListVisibleLiveSharesInput = {}): Promise<LiveScreenShareResult<LiveScreenSharePage>> {
  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const limit = clampLimit(input.limit);
  const { data, error } = await rpc(configured.data, "list_visible_live_screen_sessions", {
    target_filter: input.filter ?? "all",
    target_sort: input.sort ?? "recommended",
    target_limit: limit,
    target_cursor_started_at: input.cursor?.startedAt ?? null,
    target_cursor_id: input.cursor?.id ?? null,
  });

  if (error) return mapRpcFailure(error, "LIVE_LIST_FAILED", "Could not load live screen shares.");

  const rows = (Array.isArray(data) ? data : []) as LiveScreenSessionListRow[];
  const items = rows.map(mapListRow);
  const last = rows[rows.length - 1];
  const nextCursor: LiveScreenShareCursor | null = rows.length >= limit && last ? { startedAt: last.started_at, id: last.id } : null;

  return { ok: true, data: { items, nextCursor } };
}

async function getFeaturedLiveShare(input: Pick<ListVisibleLiveSharesInput, "filter" | "sort"> = {}): Promise<LiveScreenShareResult<LiveScreenShareSummary | null>> {
  const listResult = await listVisibleLiveShares({ filter: input.filter ?? "all", sort: input.sort ?? "recommended", limit: 1 });
  if (!listResult.ok) return listResult;
  return { ok: true, data: listResult.data.items[0] ?? null };
}

async function getVisibleLiveShareById(sessionId: string): Promise<LiveScreenShareResult<LiveScreenShareSummary>> {
  const validationError = requireSessionId(sessionId);
  if (validationError) return { ok: false, error: validationError };

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data: authData, error: authError } = await configured.data.auth.getUser();
  if (authError || !authData.user) return liveError("AUTH_REQUIRED", "Sign in to watch Picom Live.");

  const { data, error } = await rpc(configured.data, "get_visible_live_screen_session", {
    target_session_id: sessionId.trim(),
  });

  if (error) {
    // Fallback when migration is not applied yet: RLS-backed select of live/reconnecting only.
    if (hasErrorMessage(error, "PGRST202") || hasErrorMessage(error, "Could not find the function") || hasErrorMessage(error, "42883")) {
      const { data: row, error: selectError } = await untypedTables(configured.data)
        .from("community_live_screen_sessions")
        .select(LIVE_SESSION_SELECT)
        .eq("id", sessionId.trim())
        .in("status", ["live", "reconnecting"])
        .maybeSingle();
      if (selectError) return mapRpcFailure(selectError, "LIVE_LIST_FAILED", "Could not load this live stream.");
      if (!row) return liveError("LIVE_NOT_FOUND", "This live stream is unavailable.");
      return { ok: true, data: mapSessionRow(row as LiveScreenSessionRow) };
    }
    return mapRpcFailure(error, "LIVE_LIST_FAILED", "Could not load this live stream.");
  }

  const rows = (Array.isArray(data) ? data : data ? [data] : []) as LiveScreenSessionListRow[];
  const row = rows[0];
  if (!row) return liveError("LIVE_NOT_FOUND", "This live stream is unavailable.");
  return { ok: true, data: mapListRow(row) };
}

function subscribeToLiveShareSession(sessionId: string, onChange: () => void): () => void {
  const client = getSupabaseClient();
  if (!client || !sessionId.trim()) return () => undefined;

  const channel: RealtimeChannel = client
    .channel(`live-screen-session:${sessionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "community_live_screen_sessions", filter: `id=eq.${sessionId}` },
      onChange,
    )
    .subscribe();

  return () => { void client.removeChannel(channel); };
}

async function countVisibleLiveShares(): Promise<LiveScreenShareResult<number>> {
  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "count_visible_live_screen_sessions", {});
  if (error) return mapRpcFailure(error, "LIVE_LIST_FAILED", "Could not count live screen shares.");

  return { ok: true, data: Number(data ?? 0) };
}

function subscribeToVisibleLiveShares(onChange: () => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => undefined;

  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channel: RealtimeChannel = client
    .channel(`live-screen-sessions:${id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "community_live_screen_sessions" }, onChange)
    .subscribe();

  return () => { void client.removeChannel(channel); };
}

async function upsertLiveShare(input: UpsertLiveShareInput): Promise<LiveScreenShareResult<LiveScreenShareSummary>> {
  const validationError = validateUpsertInput(input);
  if (validationError) return { ok: false, error: validationError };

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "upsert_community_live_screen_session", {
    target_community_id: input.communityId,
    target_channel_id: input.channelId,
    target_livekit_room_name: input.livekitRoomName.trim(),
    target_title: input.title ?? "",
    target_category: input.category ?? "other",
    target_application_name: input.applicationName ?? "",
    target_participant_count: input.participantCount ?? 0,
  });

  if (error || !data) return mapRpcFailure(error, "LIVE_UPSERT_FAILED", "Could not start the live screen share.");
  return { ok: true, data: mapSessionRow(data as LiveScreenSessionRow) };
}

async function heartbeatLiveShare(sessionId: string, input: HeartbeatLiveShareInput = {}): Promise<LiveScreenShareResult<LiveScreenShareSummary>> {
  const validationError = requireSessionId(sessionId);
  if (validationError) return { ok: false, error: validationError };

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "heartbeat_community_live_screen_session", {
    target_session_id: sessionId,
    target_participant_count: input.participantCount ?? null,
    target_status: input.status ?? "live",
  });

  if (error || !data) return mapRpcFailure(error, "LIVE_HEARTBEAT_FAILED", "Could not send the live share heartbeat.");
  return { ok: true, data: mapSessionRow(data as LiveScreenSessionRow) };
}

async function endLiveShare(sessionId: string, status: Extract<LiveScreenShareStatus, "ended" | "terminated"> = "ended"): Promise<LiveScreenShareResult<LiveScreenShareSummary>> {
  const validationError = requireSessionId(sessionId);
  if (validationError) return { ok: false, error: validationError };

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "end_community_live_screen_session", {
    target_session_id: sessionId,
    target_status: status,
  });

  if (error || !data) return mapRpcFailure(error, "LIVE_END_FAILED", "Could not end the live screen share.");
  return { ok: true, data: mapSessionRow(data as LiveScreenSessionRow) };
}

async function joinAsViewer(sessionId: string): Promise<LiveScreenShareResult<number>> {
  const validationError = requireSessionId(sessionId);
  if (validationError) return { ok: false, error: validationError };

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "join_community_live_screen_viewer", { target_session_id: sessionId });
  if (error) return mapRpcFailure(error, "LIVE_JOIN_FAILED", "Could not join this live screen share.");
  return { ok: true, data: Number(data ?? 0) };
}

async function leaveAsViewer(sessionId: string): Promise<LiveScreenShareResult<number>> {
  const validationError = requireSessionId(sessionId);
  if (validationError) return { ok: false, error: validationError };

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "leave_community_live_screen_viewer", { target_session_id: sessionId });
  if (error) return mapRpcFailure(error, "LIVE_LEAVE_FAILED", "Could not leave this live screen share.");
  return { ok: true, data: Number(data ?? 0) };
}

async function heartbeatViewer(sessionId: string): Promise<LiveScreenShareResult<number>> {
  const validationError = requireSessionId(sessionId);
  if (validationError) return { ok: false, error: validationError };

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "heartbeat_community_live_screen_viewer", { target_session_id: sessionId });
  if (error) return mapRpcFailure(error, "LIVE_JOIN_FAILED", "Could not refresh your viewer session.");
  return { ok: true, data: Number(data ?? 0) };
}

async function hideLiveCommunity(communityId: string): Promise<LiveScreenShareResult<true>> {
  if (!communityId?.trim()) return liveError("VALIDATION_ERROR", "Community ID is required.");

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data: authData, error: authError } = await configured.data.auth.getUser();
  if (authError || !authData.user) return liveError("AUTH_REQUIRED", "Sign in to hide live communities.");

  const { error } = await untypedTables(configured.data)
    .from("community_live_hidden_communities")
    .upsert({ user_id: authData.user.id, community_id: communityId }, { onConflict: "user_id,community_id" });

  if (error) return mapRpcFailure(error, "LIVE_HIDE_FAILED", "Could not hide this community from Live.");
  return { ok: true, data: true };
}

async function unhideLiveCommunity(communityId: string): Promise<LiveScreenShareResult<true>> {
  if (!communityId?.trim()) return liveError("VALIDATION_ERROR", "Community ID is required.");

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data: authData, error: authError } = await configured.data.auth.getUser();
  if (authError || !authData.user) return liveError("AUTH_REQUIRED", "Sign in to manage hidden Live communities.");

  const { error } = await untypedTables(configured.data)
    .from("community_live_hidden_communities")
    .delete()
    .eq("user_id", authData.user.id)
    .eq("community_id", communityId);

  if (error) return mapRpcFailure(error, "LIVE_HIDE_FAILED", "Could not unhide this community.");
  return { ok: true, data: true };
}

async function reportLiveShare(sessionId: string, reason: string): Promise<LiveScreenShareResult<true>> {
  const validationError = requireSessionId(sessionId);
  if (validationError) return { ok: false, error: validationError };

  const trimmedReason = reason?.trim() ?? "";
  if (trimmedReason.length < 3 || trimmedReason.length > 500) {
    return liveError("VALIDATION_ERROR", "Report reason must be between 3 and 500 characters.");
  }

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data: authData, error: authError } = await configured.data.auth.getUser();
  if (authError || !authData.user) return liveError("AUTH_REQUIRED", "Sign in to report a live share.");

  const { error } = await untypedTables(configured.data)
    .from("community_live_share_reports")
    .insert({ session_id: sessionId, reporter_user_id: authData.user.id, reason: trimmedReason });

  if (error) {
    if (isUniqueViolation(error)) return liveError("LIVE_SHARE_CONFLICT", "You already reported this live share.");
    return mapRpcFailure(error, "LIVE_REPORT_FAILED", "Could not submit this report.");
  }

  return { ok: true, data: true };
}

async function updateLiveShareMetadata(sessionId: string, input: UpdateLiveShareMetadataInput): Promise<LiveScreenShareResult<LiveScreenShareSummary>> {
  const validationError = requireSessionId(sessionId);
  if (validationError) return { ok: false, error: validationError };

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "update_community_live_screen_broadcast_metadata", {
    target_session_id: sessionId.trim(),
    target_title: input.title ?? null,
    target_description: null,
    target_category: input.category ?? null,
    target_application_name: input.applicationName ?? null,
    target_language_code: null,
    target_chat_mode: null,
  });

  if (error || !data) return mapRpcFailure(error, "LIVE_UPDATE_FAILED", "Could not update this live share. You may not be the broadcaster.");
  return { ok: true, data: mapSessionRow(data as LiveScreenSessionRow) };
}

async function moderatorForceEndLiveShare(sessionId: string, reason = "Moderator ended the live stream"): Promise<LiveScreenShareResult<LiveScreenShareSummary>> {
  const validationError = requireSessionId(sessionId);
  if (validationError) return { ok: false, error: validationError };

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "moderator_force_end_live_screen_session", {
    target_session_id: sessionId.trim(),
    target_reason: reason.trim().slice(0, 500),
  });

  if (error || !data) return mapRpcFailure(error, "LIVE_END_FAILED", "Could not end this live stream.");
  return { ok: true, data: mapSessionRow(data as LiveScreenSessionRow) };
}

async function moderatorRemoveLiveBroadcaster(sessionId: string, reason = "Moderator removed the broadcaster from voice"): Promise<LiveScreenShareResult<LiveScreenShareSummary>> {
  const validationError = requireSessionId(sessionId);
  if (validationError) return { ok: false, error: validationError };

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { data, error } = await rpc(configured.data, "moderator_remove_live_broadcaster", {
    target_session_id: sessionId.trim(),
    target_reason: reason.trim().slice(0, 500),
  });

  if (error || !data) return mapRpcFailure(error, "LIVE_MODERATION_FAILED", "Could not remove the broadcaster from this live session.");
  return { ok: true, data: mapSessionRow(data as LiveScreenSessionRow) };
}

async function moderatorOpenLiveModerationCase(sessionId: string, reason = "Moderator opened a live moderation case"): Promise<LiveScreenShareResult<true>> {
  const validationError = requireSessionId(sessionId);
  if (validationError) return { ok: false, error: validationError };

  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 500) {
    return liveError("VALIDATION_ERROR", "Moderation reason must be between 3 and 500 characters.");
  }

  const configured = getConfiguredSupabaseClient();
  if (!configured.ok) return configured;

  const { error } = await rpc(configured.data, "moderator_open_live_moderation_case", {
    target_session_id: sessionId.trim(),
    target_reason: trimmed,
  });

  if (error) return mapRpcFailure(error, "LIVE_MODERATION_FAILED", "Could not open a moderation case for this live stream.");
  return { ok: true, data: true };
}

export const liveScreenShareService = {
  listVisibleLiveShares,
  getFeaturedLiveShare,
  getVisibleLiveShareById,
  countVisibleLiveShares,
  subscribeToVisibleLiveShares,
  subscribeToLiveShareSession,
  upsertLiveShare,
  heartbeatLiveShare,
  endLiveShare,
  joinAsViewer,
  leaveAsViewer,
  heartbeatViewer,
  hideLiveCommunity,
  unhideLiveCommunity,
  reportLiveShare,
  updateLiveShareMetadata,
  moderatorForceEndLiveShare,
  moderatorRemoveLiveBroadcaster,
  moderatorOpenLiveModerationCase,
};
