import { createPicomLiveKitRoomName } from "../voiceRoomNaming";
import { getApiCompatibilityRequestHeaders } from "../../config/apiCompatibility";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import type { LiveKitServiceErrorCode, LiveKitServiceResult, LiveKitTokenRequest, LiveKitTokenResponse } from "./livekitTypes";

type SafeFunctionFailure = Readonly<{ status: number | null; code: string | null }>;

function liveKitError(code: LiveKitServiceErrorCode, message: string): LiveKitServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function isTokenResponse(value: LiveKitTokenResponse | null): value is LiveKitTokenResponse {
  return Boolean(value?.token && value.url && value.roomName && value.identity && value.expiresAt
    && typeof value.canPublishAudio === "boolean" && typeof value.canPublishScreen === "boolean");
}

async function readSafeFunctionFailure(error: unknown): Promise<SafeFunctionFailure> {
  if (!error || typeof error !== "object" || !("context" in error)) return { status: null, code: null };
  const context = (error as { context?: unknown }).context;
  if (typeof Response === "undefined" || !(context instanceof Response)) return { status: null, code: null };

  let code: string | null = null;
  try {
    const payload: unknown = await context.clone().json();
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const candidate = (payload as { code?: unknown }).code;
      if (typeof candidate === "string" && /^[A-Z0-9_]{1,64}$/.test(candidate)) code = candidate;
    }
  } catch {
    // The HTTP status remains sufficient for a safe user-facing classification.
  }
  return { status: context.status, code };
}

async function mapFunctionError(error: unknown): Promise<LiveKitServiceResult<never>> {
  const failure = await readSafeFunctionFailure(error);
  if (failure.code === "VOICE_NOT_CONFIGURED") return liveKitError("LIVEKIT_NOT_CONFIGURED", "Voice is not configured for this environment.");
  if (failure.code === "RATE_LIMITED" || failure.status === 429) return liveKitError("LIVEKIT_RATE_LIMITED", "Too many voice join requests. Wait a moment and try again.");
  if (failure.status === 401) return liveKitError("LIVEKIT_AUTH_REQUIRED", "Your Picom session has expired. Sign in again before joining voice.");
  if (failure.code === "VOICE_CHANNEL_FORBIDDEN" || failure.status === 403) return liveKitError("LIVEKIT_ACCESS_DENIED", "Voice access requires an active community membership and an available room.");
  if (failure.code === "INTERNAL_ERROR" || (failure.status !== null && failure.status >= 500)) return liveKitError("LIVEKIT_PROVIDER_UNAVAILABLE", "The voice provider is temporarily unavailable. Try again shortly.");
  return liveKitError("LIVEKIT_TOKEN_FAILED", "Could not fetch a LiveKit token from the Edge Function.");
}

export const liveKitService = {
  async fetchToken(request: LiveKitTokenRequest): Promise<LiveKitServiceResult<LiveKitTokenResponse>> {
    const status = getSupabaseClientStatus();
    if (!status.configured) {
      return liveKitError("LIVEKIT_NOT_CONFIGURED", status.reason ?? "Supabase is not configured for LiveKit tokens.");
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return liveKitError("LIVEKIT_NOT_CONFIGURED", "Supabase client is unavailable.");
    }

    const roomName = request.roomName ?? createPicomLiveKitRoomName(request.communityId, request.channelId);
    const { data, error } = await supabase.functions
      .invoke<LiveKitTokenResponse>("livekit-token", {
        headers: getApiCompatibilityRequestHeaders(),
        body: {
          communityId: request.communityId,
          channelId: request.channelId,
          roomName,
          participantName: request.participantName,
          intent: request.intent ?? "voice",
        },
      })
      .catch(() => ({
        data: null,
        error: new Error("Could not reach the LiveKit token Edge Function."),
      }));

    if (error) {
      return mapFunctionError(error);
    }

    if (!isTokenResponse(data)) {
      return liveKitError("LIVEKIT_INVALID_TOKEN_RESPONSE", "LiveKit token response was incomplete.");
    }

    return { ok: true, data };
  },
};
