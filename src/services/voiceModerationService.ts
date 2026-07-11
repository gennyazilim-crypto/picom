import { getApiCompatibilityRequestHeaders } from "../config/apiCompatibility";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type VoiceModerationAction = "mute" | "remove";
export type VoiceModerationResult = Readonly<{ ok: true; action: VoiceModerationAction }> | Readonly<{ ok: false; message: string }>;
type EdgeResponse = { ok?: boolean; action?: VoiceModerationAction; message?: string };

export const voiceModerationService = {
  async moderate(input: { communityId: string; channelId: string; targetUserId: string; action: VoiceModerationAction }): Promise<VoiceModerationResult> {
    if (dataSourceService.getStatus().isMock) return { ok: false, message: "Server-backed voice moderation is unavailable in mock rooms." };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Voice moderation is unavailable." };
    const { data, error } = await client.functions.invoke<EdgeResponse>("livekit-moderation", { headers: getApiCompatibilityRequestHeaders(), body: input });
    if (error || !data?.ok || data.action !== input.action) return { ok: false, message: data?.message || "The voice moderation action was denied or could not be completed." };
    return { ok: true, action: input.action };
  },
};
