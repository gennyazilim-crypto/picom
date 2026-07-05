import { createPicomLiveKitRoomName } from "../voiceRoomNaming";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import type { LiveKitServiceErrorCode, LiveKitServiceResult, LiveKitTokenRequest, LiveKitTokenResponse } from "./livekitTypes";

function liveKitError(code: LiveKitServiceErrorCode, message: string): LiveKitServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function isTokenResponse(value: LiveKitTokenResponse | null): value is LiveKitTokenResponse {
  return Boolean(value?.token && value.url && value.roomName && value.identity && value.expiresAt);
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
    const { data, error } = await supabase.functions.invoke<LiveKitTokenResponse>("livekit-token", {
      body: {
        communityId: request.communityId,
        channelId: request.channelId,
        roomName,
        participantName: request.participantName,
        intent: request.intent ?? "voice",
      },
    });

    if (error) {
      return liveKitError("LIVEKIT_TOKEN_FAILED", "Could not fetch a LiveKit token from the Edge Function.");
    }

    if (!isTokenResponse(data)) {
      return liveKitError("LIVEKIT_INVALID_TOKEN_RESPONSE", "LiveKit token response was incomplete.");
    }

    return { ok: true, data };
  },
};
