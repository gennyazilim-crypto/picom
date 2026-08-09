import { getSupabaseClient } from "../supabase/supabaseClient";
import { featureFlagService } from "../featureFlagService";
import { appConfig } from "../../config/appConfig";

type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

function rpc(client: NonNullable<ReturnType<typeof getSupabaseClient>>, fn: string, args: Record<string, unknown> = {}) {
  return (client as unknown as RpcClient).rpc(fn, args);
}

async function invokeRecordingFunction(body: Record<string, unknown>): Promise<Result<Record<string, unknown>>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
  const session = await client.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) return { ok: false, code: "AUTH_REQUIRED", message: "Authentication required." };
  const base = String(appConfig.supabase.url || "").replace(/\/$/, "");
  if (!base) return { ok: false, code: "RPC_FAILED", message: "Supabase URL unavailable." };
  const response = await fetch(`${base}/functions/v1/publisher-recording`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: String(appConfig.supabase.anonKey || ""),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    return {
      ok: false,
      code: String(json.code ?? json.error ?? "REQUEST_FAILED"),
      message: String(json.message ?? json.error_description ?? "Recording request failed."),
    };
  }
  return { ok: true, data: json };
}

export type PublisherReplayListItem = Readonly<{
  id: string;
  streamId: string;
  recordingId: string;
  title: string;
  visibility: string;
  status: string;
  durationMs: number | null;
  recordingStatus: string | null;
  processingState: string | null;
  sizeBytes: number | null;
  failureCode: string | null;
  createdAt: string | null;
}>;

export const publisherRecordingService = {
  async setRecordingEnabled(streamId: string, enabled: boolean): Promise<Result<{ recordingEnabled: boolean }>> {
    if (!featureFlagService.isEnabled("enableLiveRecording")) {
      return { ok: false, code: "FEATURE_DISABLED", message: "Live recording is disabled." };
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { data, error } = await rpc(client, "set_publisher_stream_recording_enabled", {
      target_stream_id: streamId,
      target_enabled: enabled,
    });
    if (error) return { ok: false, code: "RPC_FAILED", message: error.message ?? "RPC failed" };
    const row = data as Record<string, unknown>;
    return { ok: true, data: { recordingEnabled: row.recording_enabled === true } };
  },

  async startRecording(streamId: string): Promise<Result<{ recordingId: string; status: string }>> {
    if (!featureFlagService.isEnabled("enableLiveRecording")) {
      return { ok: false, code: "FEATURE_DISABLED", message: "Live recording is disabled." };
    }
    const result = await invokeRecordingFunction({ action: "start", streamId });
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        recordingId: String(result.data.recordingId ?? ""),
        status: String(result.data.status ?? "FAILED"),
      },
    };
  },

  async stopRecording(streamId: string): Promise<Result<true>> {
    if (!featureFlagService.isEnabled("enableLiveRecording")) {
      return { ok: false, code: "FEATURE_DISABLED", message: "Live recording is disabled." };
    }
    const result = await invokeRecordingFunction({ action: "stop", streamId });
    if (!result.ok) return result;
    return { ok: true, data: true };
  },

  async listReplays(input?: {
    status?: string;
    visibility?: string;
    limit?: number;
    offset?: number;
  }): Promise<Result<ReadonlyArray<PublisherReplayListItem>>> {
    if (!featureFlagService.isEnabled("enableLiveReplays")) {
      return { ok: false, code: "FEATURE_DISABLED", message: "Live replays are disabled." };
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { data, error } = await rpc(client, "list_my_publisher_replays", {
      status_filter: input?.status ?? null,
      visibility_filter: input?.visibility ?? null,
      page_limit: input?.limit ?? 40,
      page_offset: input?.offset ?? 0,
    });
    if (error) return { ok: false, code: "RPC_FAILED", message: error.message ?? "RPC failed" };
    const payload = data as { items?: unknown };
    const items = Array.isArray(payload.items) ? payload.items : [];
    return {
      ok: true,
      data: items.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          id: String(row.id ?? ""),
          streamId: String(row.stream_id ?? ""),
          recordingId: String(row.recording_id ?? ""),
          title: String(row.title ?? ""),
          visibility: String(row.visibility ?? "PRIVATE"),
          status: String(row.status ?? ""),
          durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
          recordingStatus: row.recording_status == null ? null : String(row.recording_status),
          processingState: row.processing_state == null ? null : String(row.processing_state),
          sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
          failureCode: row.failure_code == null ? null : String(row.failure_code),
          createdAt: typeof row.created_at === "string" ? row.created_at : null,
        };
      }),
    };
  },

  async updateReplay(input: {
    replayId: string;
    title?: string;
    description?: string;
    visibility?: string;
    action?: "publish" | "archive" | "delete";
  }): Promise<Result<{ status: string; visibility: string }>> {
    if (!featureFlagService.isEnabled("enableLiveReplays")) {
      return { ok: false, code: "FEATURE_DISABLED", message: "Live replays are disabled." };
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { data, error } = await rpc(client, "update_my_publisher_replay", {
      target_replay_id: input.replayId,
      target_title: input.title ?? null,
      target_description: input.description ?? null,
      target_visibility: input.visibility ?? null,
      target_action: input.action ?? null,
    });
    if (error) return { ok: false, code: "RPC_FAILED", message: error.message ?? "RPC failed" };
    const row = data as Record<string, unknown>;
    return { ok: true, data: { status: String(row.status ?? ""), visibility: String(row.visibility ?? "") } };
  },

  async createClip(input: {
    replayId: string;
    startMs: number;
    endMs: number;
    title: string;
    visibility?: string;
  }): Promise<Result<{ clipId: string; status: string }>> {
    if (!featureFlagService.isEnabled("enableLiveClips")) {
      return { ok: false, code: "FEATURE_DISABLED", message: "Live clips are disabled." };
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, code: "RPC_FAILED", message: "Supabase unavailable." };
    const { data, error } = await rpc(client, "request_publisher_clip", {
      target_replay_id: input.replayId,
      target_start_ms: input.startMs,
      target_end_ms: input.endMs,
      target_title: input.title,
      target_visibility: input.visibility ?? "PRIVATE",
      target_idempotency_key: null,
    });
    if (error) return { ok: false, code: "RPC_FAILED", message: error.message ?? "RPC failed" };
    const row = data as Record<string, unknown>;
    return { ok: true, data: { clipId: String(row.clip_id ?? ""), status: String(row.status ?? "") } };
  },

  async getPlaybackUrl(replayId: string): Promise<Result<{ url: string; expiresInSeconds: number }>> {
    if (!featureFlagService.isEnabled("enableLiveReplays")) {
      return { ok: false, code: "FEATURE_DISABLED", message: "Live replays are disabled." };
    }
    const result = await invokeRecordingFunction({ action: "sign_playback", replayId });
    if (!result.ok) return result;
    return {
      ok: true,
      data: {
        url: String(result.data.url ?? ""),
        expiresInSeconds: Number(result.data.expiresInSeconds ?? 300),
      },
    };
  },
};
