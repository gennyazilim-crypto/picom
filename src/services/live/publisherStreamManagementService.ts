import { getApiCompatibilityRequestHeaders } from "../../config/apiCompatibility";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import { featureFlagService } from "../featureFlagService";
import { loggingService } from "../loggingService";

export type PublisherStreamStatus =
  | "draft"
  | "scheduled"
  | "ready"
  | "connecting"
  | "live"
  | "reconnecting"
  | "ending"
  | "ended"
  | "cancelled"
  | "failed";

export type PublisherStreamIngestMode = "PICOM_NATIVE" | "OBS_EXTERNAL";

export type PublisherStreamConnectionState =
  | "NOT_CONNECTED"
  | "WAITING"
  | "CONNECTED"
  | "PUBLISHING"
  | "UNHEALTHY"
  | "DISCONNECTED"
  | "REVOKED";

export type PublisherStreamHealthStatus =
  | "EXCELLENT"
  | "GOOD"
  | "DEGRADED"
  | "POOR"
  | "DISCONNECTED";

export type PublisherStreamVisibility = "public" | "unlisted" | "private";

export type PublisherStream = Readonly<{
  id: string;
  ownerUserId: string;
  publisherProfileId: string | null;
  scheduleId: string | null;
  liveSessionId: string | null;
  title: string;
  description: string;
  category: string;
  tags: readonly string[];
  coverStoragePath: string | null;
  visibility: PublisherStreamVisibility;
  moderationMode: string;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: PublisherStreamStatus;
  ingestMode: PublisherStreamIngestMode;
  roomName: string | null;
  connectionState: PublisherStreamConnectionState;
  healthStatus: PublisherStreamHealthStatus;
  clientRequestId: string | null;
  createdAt: string;
  updatedAt: string;
}>;

/** One-time credential payload. plaintextSecret must stay in memory only — never log or persist. */
export type PublisherStreamCredentialReveal = Readonly<{
  credentialId: string;
  prefix: string;
  plaintextSecret: string;
  ingestUrl: string;
  protocol: string;
  revealedOnce: boolean;
}>;

export type PublisherStreamConnectionTest = Readonly<{
  connectionState: PublisherStreamConnectionState;
  testedAt: string;
}>;

export type PublisherStreamManagementErrorCode =
  | "FEATURE_DISABLED"
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "STREAM_FORBIDDEN"
  | "STREAM_NOT_FOUND"
  | "STREAM_RPC_FAILED"
  | "UNKNOWN_ERROR";

export type PublisherStreamManagementError = Readonly<{
  code: PublisherStreamManagementErrorCode;
  message: string;
  safeCode: string;
}>;

export type PublisherStreamManagementResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: PublisherStreamManagementError }>;

export type CreatePublisherStreamInput = Readonly<{
  title: string;
  description?: string;
  category?: string;
  tags?: readonly string[];
  visibility?: PublisherStreamVisibility;
  ingestMode?: PublisherStreamIngestMode;
  scheduledAt?: string | null;
  moderationMode?: string;
  clientRequestId?: string | null;
}>;

export type UpdatePublisherStreamInput = Readonly<{
  title?: string;
  description?: string;
  category?: string;
  tags?: readonly string[];
  visibility?: PublisherStreamVisibility;
  moderationMode?: string;
  scheduledAt?: string | null;
  coverStoragePath?: string | null;
  clearCover?: boolean;
}>;

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string; details?: string; hint?: string } | null }>;
};

type StreamRow = Readonly<{
  id: string;
  owner_user_id: string;
  publisher_profile_id: string | null;
  schedule_id: string | null;
  live_session_id: string | null;
  title: string;
  description: string;
  category: string;
  tags: string[] | null;
  cover_storage_path: string | null;
  visibility: string;
  moderation_mode: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  ingest_mode: string;
  room_name: string | null;
  connection_state: string;
  health_status: string;
  client_request_id: string | null;
  created_at: string;
  updated_at: string;
}>;

const STATUSES: readonly PublisherStreamStatus[] = [
  "draft",
  "scheduled",
  "ready",
  "connecting",
  "live",
  "reconnecting",
  "ending",
  "ended",
  "cancelled",
  "failed",
];

const CONNECTION_STATES: readonly PublisherStreamConnectionState[] = [
  "NOT_CONNECTED",
  "WAITING",
  "CONNECTED",
  "PUBLISHING",
  "UNHEALTHY",
  "DISCONNECTED",
  "REVOKED",
];

const HEALTH_STATUSES: readonly PublisherStreamHealthStatus[] = [
  "EXCELLENT",
  "GOOD",
  "DEGRADED",
  "POOR",
  "DISCONNECTED",
];

function fail(
  code: PublisherStreamManagementErrorCode,
  message: string,
  safeCode = code,
): PublisherStreamManagementResult<never> {
  return { ok: false, error: { code, message, safeCode } };
}

function featureGate(): PublisherStreamManagementResult<never> | null {
  if (!featureFlagService.isEnabled("enablePublisherStreamManagement")) {
    return fail("FEATURE_DISABLED", "Publisher stream management is disabled.", "FEATURE_DISABLED");
  }
  return null;
}

function externalIngestGate(): PublisherStreamManagementResult<never> | null {
  const streamGate = featureGate();
  if (streamGate) return streamGate;
  if (!featureFlagService.isEnabled("enablePublisherExternalIngest")) {
    return fail("FEATURE_DISABLED", "Publisher external ingest is disabled.", "FEATURE_DISABLED");
  }
  return null;
}

function clientConfigured(): PublisherStreamManagementResult<NonNullable<ReturnType<typeof getSupabaseClient>>> {
  const status = getSupabaseClientStatus();
  if (!status.configured) {
    return fail("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase is not configured.");
  }
  const client = getSupabaseClient();
  if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase client unavailable.");
  return { ok: true, data: client };
}

function rpc(client: NonNullable<ReturnType<typeof getSupabaseClient>>, fn: string, args: Record<string, unknown> = {}) {
  return (client as unknown as RpcClient).rpc(fn, args);
}

function errorBlob(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const candidate = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  return [candidate.message, candidate.code, candidate.details, candidate.hint]
    .filter((part) => part != null && String(part).trim() !== "")
    .map(String)
    .join(" ");
}

function mapFailure(error: unknown, fallback: PublisherStreamManagementErrorCode, message: string): PublisherStreamManagementResult<never> {
  const blob = errorBlob(error).toUpperCase();
  if (blob.includes("AUTH_REQUIRED") || blob.includes("JWT")) {
    return fail("AUTH_REQUIRED", "Sign in to manage streams.", "AUTH_REQUIRED");
  }
  if (
    blob.includes("STREAM_OWNER_REQUIRED") ||
    blob.includes("PUBLISHER_BROADCAST_NOT_ALLOWED") ||
    blob.includes("42501") ||
    blob.includes("FORBIDDEN")
  ) {
    return fail("STREAM_FORBIDDEN", "You do not have permission for this stream action.", "STREAM_FORBIDDEN");
  }
  if (blob.includes("STREAM_NOT_FOUND") || blob.includes("P0002")) {
    return fail("STREAM_NOT_FOUND", "Stream was not found.", "STREAM_NOT_FOUND");
  }
  if (
    blob.includes("22023") ||
    blob.includes("INVALID") ||
    blob.includes("VALIDATION") ||
    blob.includes("STREAM_TITLE") ||
    blob.includes("STREAM_SCHEDULE") ||
    blob.includes("STREAM_STATUS") ||
    blob.includes("STREAM_TRANSITION") ||
    blob.includes("STREAM_PREPARE") ||
    blob.includes("STREAM_CREDENTIAL")
  ) {
    return fail("VALIDATION_ERROR", message, "VALIDATION_ERROR");
  }
  loggingService.logWarn("Publisher stream management RPC failed", { fallback, text: blob.slice(0, 240) }, "live");
  return fail(fallback, message);
}

function asStatus(value: string): PublisherStreamStatus {
  return STATUSES.includes(value as PublisherStreamStatus) ? (value as PublisherStreamStatus) : "failed";
}

function asConnection(value: string): PublisherStreamConnectionState {
  return CONNECTION_STATES.includes(value as PublisherStreamConnectionState)
    ? (value as PublisherStreamConnectionState)
    : "DISCONNECTED";
}

function asHealth(value: string): PublisherStreamHealthStatus {
  return HEALTH_STATUSES.includes(value as PublisherStreamHealthStatus)
    ? (value as PublisherStreamHealthStatus)
    : "DISCONNECTED";
}

function asVisibility(value: string): PublisherStreamVisibility {
  return value === "unlisted" || value === "private" ? value : "public";
}

function asIngestMode(value: string): PublisherStreamIngestMode {
  return value === "OBS_EXTERNAL" ? "OBS_EXTERNAL" : "PICOM_NATIVE";
}

function mapStream(row: StreamRow): PublisherStream {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    publisherProfileId: row.publisher_profile_id,
    scheduleId: row.schedule_id,
    liveSessionId: row.live_session_id,
    title: row.title,
    description: row.description ?? "",
    category: row.category ?? "other",
    tags: Array.isArray(row.tags) ? row.tags : [],
    coverStoragePath: row.cover_storage_path,
    visibility: asVisibility(row.visibility),
    moderationMode: row.moderation_mode ?? "standard",
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    status: asStatus(row.status),
    ingestMode: asIngestMode(row.ingest_mode),
    roomName: row.room_name,
    connectionState: asConnection(row.connection_state),
    healthStatus: asHealth(row.health_status),
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStreamResult(data: unknown): PublisherStream | null {
  const row = Array.isArray(data) ? (data[0] as StreamRow | undefined) : (data as StreamRow | null);
  return row?.id ? mapStream(row) : null;
}

function mapStreams(data: unknown): PublisherStream[] {
  if (!Array.isArray(data)) {
    const single = mapStreamResult(data);
    return single ? [single] : [];
  }
  return data
    .map((row) => (row && typeof row === "object" && "id" in row ? mapStream(row as StreamRow) : null))
    .filter((row): row is PublisherStream => Boolean(row));
}

/**
 * Map credential RPC JSON. plaintext_secret is returned only here for one-time UI reveal.
 * Callers must not log, persist, or put this value in localStorage.
 */
function mapCredentialReveal(data: unknown): PublisherStreamCredentialReveal | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const credentialId =
    typeof row.credential_id === "string"
      ? row.credential_id
      : typeof row.credentialId === "string"
        ? row.credentialId
        : "";
  const plaintextSecret =
    typeof row.plaintext_secret === "string"
      ? row.plaintext_secret
      : typeof row.streamKey === "string"
        ? row.streamKey
        : "";
  const ingestUrl =
    typeof row.ingest_url === "string" ? row.ingest_url : typeof row.url === "string" ? row.url : "";
  if (!credentialId || !plaintextSecret || !ingestUrl) return null;
  return {
    credentialId,
    prefix: typeof row.prefix === "string" ? row.prefix : "",
    plaintextSecret,
    ingestUrl,
    protocol: typeof row.protocol === "string" ? row.protocol : "RTMP",
    revealedOnce: row.revealed_once !== false && row.revealedOnce !== false,
  };
}

async function provisionIngressCredential(
  streamId: string,
  mode: "create" | "rotate",
): Promise<PublisherStreamManagementResult<PublisherStreamCredentialReveal>> {
  const gate = externalIngestGate();
  if (gate) return gate;
  const configured = clientConfigured();
  if (!configured.ok) return configured;

  // Never log the response body — it may contain a one-time LiveKit stream key.
  const { data, error } = await configured.data.functions.invoke("livekit-ingress", {
    headers: getApiCompatibilityRequestHeaders(),
    body: { action: "provisionForStream", streamId },
  });
  if (error) {
    return mapFailure(
      error,
      "STREAM_RPC_FAILED",
      mode === "rotate" ? "Could not rotate LiveKit Ingress credential." : "Could not create LiveKit Ingress credential.",
    );
  }
  const reveal = mapCredentialReveal(data);
  if (!reveal) {
    return fail("STREAM_RPC_FAILED", "Ingress provision returned an incomplete one-time credential payload.");
  }
  return { ok: true, data: reveal };
}

function mapConnectionTest(data: unknown): PublisherStreamConnectionTest | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const connectionState = typeof row.connection_state === "string" ? asConnection(row.connection_state) : null;
  const testedAt = typeof row.tested_at === "string" ? row.tested_at : null;
  if (!connectionState || !testedAt) return null;
  return { connectionState, testedAt };
}

async function requireClient(): Promise<PublisherStreamManagementResult<NonNullable<ReturnType<typeof getSupabaseClient>>>> {
  const gate = featureGate();
  if (gate) return gate;
  return clientConfigured();
}

export const publisherStreamManagementService = {
  async createStream(input: CreatePublisherStreamInput): Promise<PublisherStreamManagementResult<PublisherStream>> {
    const configured = await requireClient();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "create_publisher_stream", {
      target_title: input.title,
      target_description: input.description ?? "",
      target_category: input.category ?? "other",
      target_tags: input.tags ? [...input.tags] : [],
      target_visibility: input.visibility ?? "public",
      target_ingest_mode: input.ingestMode ?? "PICOM_NATIVE",
      target_scheduled_at: input.scheduledAt ?? null,
      target_moderation_mode: input.moderationMode ?? "standard",
      target_client_request_id: input.clientRequestId ?? null,
    });
    if (error) return mapFailure(error, "STREAM_RPC_FAILED", "Could not create stream.");
    const stream = mapStreamResult(data);
    if (!stream) return fail("STREAM_RPC_FAILED", "Create stream returned no row.");
    return { ok: true, data: stream };
  },

  async updateStream(
    streamId: string,
    input: UpdatePublisherStreamInput,
  ): Promise<PublisherStreamManagementResult<PublisherStream>> {
    const configured = await requireClient();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "update_publisher_stream", {
      target_stream_id: streamId,
      target_title: input.title ?? null,
      target_description: input.description ?? null,
      target_category: input.category ?? null,
      target_tags: input.tags ? [...input.tags] : null,
      target_visibility: input.visibility ?? null,
      target_moderation_mode: input.moderationMode ?? null,
      target_scheduled_at: input.scheduledAt === undefined ? null : input.scheduledAt,
      target_cover_storage_path: input.coverStoragePath ?? null,
      target_clear_cover: input.clearCover ?? false,
    });
    if (error) return mapFailure(error, "STREAM_RPC_FAILED", "Could not update stream.");
    const stream = mapStreamResult(data);
    if (!stream) return fail("STREAM_RPC_FAILED", "Update stream returned no row.");
    return { ok: true, data: stream };
  },

  async transitionStream(
    streamId: string,
    toStatus: PublisherStreamStatus,
    reason?: string | null,
    correlationId?: string | null,
  ): Promise<PublisherStreamManagementResult<PublisherStream>> {
    const configured = await requireClient();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "transition_publisher_stream", {
      target_stream_id: streamId,
      target_to_status: toStatus,
      target_reason: reason ?? null,
      target_correlation_id: correlationId ?? null,
    });
    if (error) return mapFailure(error, "STREAM_RPC_FAILED", "Could not transition stream.");
    const stream = mapStreamResult(data);
    if (!stream) return fail("STREAM_RPC_FAILED", "Transition returned no row.");
    return { ok: true, data: stream };
  },

  async scheduleStream(streamId: string, scheduledAt: string): Promise<PublisherStreamManagementResult<PublisherStream>> {
    const configured = await requireClient();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "schedule_publisher_stream", {
      target_stream_id: streamId,
      target_scheduled_at: scheduledAt,
    });
    if (error) return mapFailure(error, "STREAM_RPC_FAILED", "Could not schedule stream.");
    const stream = mapStreamResult(data);
    if (!stream) return fail("STREAM_RPC_FAILED", "Schedule returned no row.");
    return { ok: true, data: stream };
  },

  async cancelStream(streamId: string, reason?: string | null): Promise<PublisherStreamManagementResult<PublisherStream>> {
    const configured = await requireClient();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "cancel_publisher_stream", {
      target_stream_id: streamId,
      target_reason: reason ?? null,
    });
    if (error) return mapFailure(error, "STREAM_RPC_FAILED", "Could not cancel stream.");
    const stream = mapStreamResult(data);
    if (!stream) return fail("STREAM_RPC_FAILED", "Cancel returned no row.");
    return { ok: true, data: stream };
  },

  async prepareStream(streamId: string): Promise<PublisherStreamManagementResult<PublisherStream>> {
    const configured = await requireClient();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "prepare_publisher_stream", {
      target_stream_id: streamId,
    });
    if (error) return mapFailure(error, "STREAM_RPC_FAILED", "Could not prepare stream.");
    const stream = mapStreamResult(data);
    if (!stream) return fail("STREAM_RPC_FAILED", "Prepare returned no row.");
    return { ok: true, data: stream };
  },

  async createCredential(streamId: string): Promise<PublisherStreamManagementResult<PublisherStreamCredentialReveal>> {
    return provisionIngressCredential(streamId, "create");
  },

  async rotateCredential(streamId: string): Promise<PublisherStreamManagementResult<PublisherStreamCredentialReveal>> {
    // provisionForStream deletes the prior LiveKit Ingress before CreateIngress.
    return provisionIngressCredential(streamId, "rotate");
  },

  async revokeCredential(streamId: string): Promise<PublisherStreamManagementResult<PublisherStream>> {
    const gate = externalIngestGate();
    if (gate) return gate;
    const configured = clientConfigured();
    if (!configured.ok) return configured;

    // Delete LiveKit Ingress first so the stream key stops working immediately.
    const { error: ingressError } = await configured.data.functions.invoke("livekit-ingress", {
      headers: getApiCompatibilityRequestHeaders(),
      body: { action: "delete", streamId },
    });
    if (ingressError) {
      return mapFailure(ingressError, "STREAM_RPC_FAILED", "Could not delete LiveKit Ingress for revoke.");
    }

    const { data, error } = await rpc(configured.data, "revoke_publisher_stream_credential", {
      target_stream_id: streamId,
    });
    if (error) return mapFailure(error, "STREAM_RPC_FAILED", "Could not revoke stream credential.");
    const stream = mapStreamResult(data);
    if (!stream) return fail("STREAM_RPC_FAILED", "Revoke returned no row.");
    return { ok: true, data: stream };
  },

  async testCredential(streamId: string): Promise<PublisherStreamManagementResult<PublisherStreamConnectionTest>> {
    const gate = externalIngestGate();
    if (gate) return gate;
    const configured = clientConfigured();
    if (!configured.ok) return configured;

    // Provider probe (no plaintext key). Never invent CONNECTED from a button click.
    const { data: ingressData, error: ingressError } = await configured.data.functions.invoke<{
      remotePresent?: boolean;
      hasActiveCredential?: boolean;
    }>("livekit-ingress", {
      headers: getApiCompatibilityRequestHeaders(),
      body: { action: "get", streamId },
    });
    if (ingressError) {
      return mapFailure(ingressError, "STREAM_RPC_FAILED", "Could not probe LiveKit Ingress.");
    }

    const { data, error } = await rpc(configured.data, "test_publisher_stream_credential", {
      target_stream_id: streamId,
    });
    if (error) return mapFailure(error, "STREAM_RPC_FAILED", "Could not test stream credential.");
    const result = mapConnectionTest(data);
    if (!result) return fail("STREAM_RPC_FAILED", "Connection test returned an incomplete payload.");

    // Surface provider absence without upgrading connection_state in the DB.
    if (ingressData && ingressData.hasActiveCredential && ingressData.remotePresent === false) {
      return {
        ok: true,
        data: {
          connectionState: result.connectionState === "PUBLISHING" ? "UNHEALTHY" : result.connectionState,
          testedAt: result.testedAt,
        },
      };
    }
    return { ok: true, data: result };
  },

  async listStreams(statusFilter?: PublisherStreamStatus | null, limit = 40): Promise<PublisherStreamManagementResult<PublisherStream[]>> {
    const configured = await requireClient();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "list_my_publisher_streams", {
      status_filter: statusFilter ?? null,
      target_limit: limit,
    });
    if (error) return mapFailure(error, "STREAM_RPC_FAILED", "Could not list streams.");
    return { ok: true, data: mapStreams(data) };
  },

  async getStream(streamId: string): Promise<PublisherStreamManagementResult<PublisherStream>> {
    const configured = await requireClient();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "get_my_publisher_stream", {
      target_stream_id: streamId,
    });
    if (error) return mapFailure(error, "STREAM_RPC_FAILED", "Could not load stream.");
    const stream = mapStreamResult(data);
    if (!stream) return fail("STREAM_NOT_FOUND", "Stream was not found.");
    return { ok: true, data: stream };
  },

  async linkLiveSession(
    streamId: string,
    liveSessionId: string,
  ): Promise<PublisherStreamManagementResult<PublisherStream>> {
    const configured = await requireClient();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "link_publisher_stream_live_session", {
      target_stream_id: streamId,
      target_live_session_id: liveSessionId,
    });
    if (error) return mapFailure(error, "STREAM_RPC_FAILED", "Could not link live session.");
    const stream = mapStreamResult(data);
    if (!stream) return fail("STREAM_RPC_FAILED", "Link returned no row.");
    return { ok: true, data: stream };
  },

  async rootTerminate(streamId: string, reason?: string | null): Promise<PublisherStreamManagementResult<PublisherStream>> {
    const configured = await requireClient();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "root_terminate_publisher_stream", {
      target_stream_id: streamId,
      target_reason: reason ?? null,
    });
    if (error) return mapFailure(error, "STREAM_RPC_FAILED", "Could not terminate stream.");
    const stream = mapStreamResult(data);
    if (!stream) return fail("STREAM_RPC_FAILED", "Terminate returned no row.");
    return { ok: true, data: stream };
  },
};
