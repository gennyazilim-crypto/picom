import { createPicomLiveKitRoomName } from "../voiceRoomNaming";
import { getApiCompatibilityRequestHeaders } from "../../config/apiCompatibility";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import type { LiveKitServiceErrorCode, LiveKitServiceResult, LiveKitTokenRequest, LiveKitTokenResponse } from "./livekitTypes";

function liveKitError(code: LiveKitServiceErrorCode, message: string): LiveKitServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function isTokenResponse(value: LiveKitTokenResponse | null): value is LiveKitTokenResponse {
  return Boolean(value?.token && value.url && value.roomName && value.identity && value.expiresAt
    && typeof value.canPublishAudio === "boolean" && typeof value.canPublishScreen === "boolean");
}

type EdgeFunctionErrorPayload = Readonly<{ code?: string; message?: string }>;

async function getTokenFailureMessage(error: unknown): Promise<string> {
  const context = typeof error === "object" && error !== null && "context" in error
    ? (error as { context?: unknown }).context
    : undefined;
  let payload: EdgeFunctionErrorPayload | null = null;
  let responseStatus: number | null = null;
  if (context instanceof Response) {
    responseStatus = context.status;
    payload = await context.clone().json().catch(() => null) as EdgeFunctionErrorPayload | null;
  }

  switch (payload?.code) {
    case "AUTH_REQUIRED":
    case "AUTH_INVALID":
      return "Your session expired. Sign in again before joining voice.";
    case "VOICE_MEMBERSHIP_REQUIRED":
      return "Join this community before entering voice.";
    case "VOICE_CHANNEL_FORBIDDEN":
    case "VOICE_PRIVATE_CHANNEL_FORBIDDEN":
      return "This voice channel is unavailable or your access has changed.";
    case "VOICE_NOT_CONFIGURED":
      return "The Picom Voice service is not configured.";
    case "RATE_LIMITED":
      return "Too many voice connection attempts. Wait briefly and try again.";
    case "VALIDATION_ERROR":
      return payload.message === "A valid communityId and channelId are required."
        ? "The selected voice channel has not synchronized with Supabase."
        : "The Voice service rejected invalid channel data.";
    default:
      // Surface the real server-provided reason (and status) so an unexpected
      // failure is diagnosable instead of hidden behind a generic message.
      if (typeof payload?.message === "string" && payload.message.trim()) {
        const detail = payload.message.trim().slice(0, 200);
        return responseStatus
          ? `Voice token request failed (${responseStatus}): ${detail}`
          : `Voice token request failed: ${detail}`;
      }
      if (responseStatus) {
        return `Could not fetch a LiveKit token from the Edge Function (server responded ${responseStatus}).`;
      }
      return "Could not fetch a LiveKit token from the Edge Function.";
  }
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
      return liveKitError("LIVEKIT_TOKEN_FAILED", await getTokenFailureMessage(error));
    }

    if (!isTokenResponse(data)) {
      return liveKitError("LIVEKIT_INVALID_TOKEN_RESPONSE", "LiveKit token response was incomplete.");
    }

    return { ok: true, data };
  },

  // Direct (1:1) DM call token: authorized by conversation participation instead of
  // community membership. Requires the livekit-token Edge Function `conversationId`
  // branch + the authorize_direct_livekit_room RPC to be deployed.
  async fetchDirectToken(request: { conversationId: string; callId?: string; intent?: "voice" | "video" | "screen"; participantName?: string }): Promise<LiveKitServiceResult<LiveKitTokenResponse>> {
    const status = getSupabaseClientStatus();
    if (!status.configured) {
      return liveKitError("LIVEKIT_NOT_CONFIGURED", status.reason ?? "Supabase is not configured for LiveKit tokens.");
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return liveKitError("LIVEKIT_NOT_CONFIGURED", "Supabase client is unavailable.");
    }

    const { data, error } = await supabase.functions
      .invoke<LiveKitTokenResponse>("livekit-token", {
        headers: getApiCompatibilityRequestHeaders(),
        body: {
          conversationId: request.conversationId,
          callId: request.callId,
          participantName: request.participantName,
          intent: request.intent ?? "voice",
        },
      })
      .catch(() => ({
        data: null,
        error: new Error("Could not reach the LiveKit token Edge Function."),
      }));

    if (error) {
      return liveKitError("LIVEKIT_TOKEN_FAILED", await getTokenFailureMessage(error));
    }

    if (!isTokenResponse(data)) {
      return liveKitError("LIVEKIT_INVALID_TOKEN_RESPONSE", "LiveKit token response was incomplete.");
    }

    return { ok: true, data };
  },
};
