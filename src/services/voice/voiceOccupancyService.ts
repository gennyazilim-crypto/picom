import { getApiCompatibilityRequestHeaders } from "../../config/apiCompatibility";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import type { VoiceRoomOccupancy } from "../../types/voiceDiscovery";

export type VoiceOccupancyRequest = Readonly<{
  communityId: string;
  channelId: string;
}>;

export type VoiceOccupancyResponse = VoiceRoomOccupancy & Readonly<{
  communityId: string;
  channelId: string;
  roomName?: string;
}>;

type EdgeErrorPayload = Readonly<{ code?: string; message?: string }>;

function failureMessage(payload: EdgeErrorPayload | null, fallback: string): string {
  if (typeof payload?.message === "string" && payload.message.trim()) return payload.message.trim().slice(0, 200);
  return fallback;
}

export const voiceOccupancyService = {
  async fetchOccupancy(request: VoiceOccupancyRequest): Promise<{ ok: true; data: VoiceOccupancyResponse } | { ok: false; error: string }> {
    const status = getSupabaseClientStatus();
    if (!status.configured) {
      return { ok: false, error: status.reason ?? "Supabase is not configured." };
    }
    const supabase = getSupabaseClient();
    if (!supabase) return { ok: false, error: "Supabase client is unavailable." };

    const { data, error } = await supabase.functions.invoke<VoiceOccupancyResponse>("voice-occupancy", {
      headers: getApiCompatibilityRequestHeaders(),
      body: {
        communityId: request.communityId,
        channelId: request.channelId,
      },
    });

    if (error) {
      let payload: EdgeErrorPayload | null = null;
      if (error && typeof error === "object" && "context" in error && (error as { context?: unknown }).context instanceof Response) {
        payload = await ((error as { context: Response }).context).clone().json().catch(() => null) as EdgeErrorPayload | null;
      }
      return { ok: false, error: failureMessage(payload, "Could not load voice occupancy.") };
    }

    if (!data || typeof data.participantCount !== "number") {
      return { ok: false, error: "Voice occupancy response was invalid." };
    }

    return {
      ok: true,
      data: {
        communityId: request.communityId,
        channelId: request.channelId,
        roomName: data.roomName,
        participantCount: data.participantCount,
        participantNames: data.participantNames ?? [],
        participants: data.participants ?? [],
      },
    };
  },
};
