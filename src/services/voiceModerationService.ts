import { getApiCompatibilityRequestHeaders } from "../config/apiCompatibility";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type VoiceModerationAction = "mute" | "remove" | "deny_screen_share";
export type VoiceModerationResult = Readonly<{ ok: true; action: VoiceModerationAction }> | Readonly<{ ok: false; message: string }>;
type EdgeResponse = { ok?: boolean; action?: VoiceModerationAction; message?: string };
type CommunityVoiceModerationInput = Readonly<{ scope?: "voice"; communityId: string; channelId: string; targetUserId: string; action: Exclude<VoiceModerationAction, "deny_screen_share"> }>;
type MeetingModerationInput = Readonly<{ scope: "meeting"; roomId: string; sessionId: string; targetParticipantId: string; action: VoiceModerationAction }>;

export const voiceModerationService = {
  async moderate(input: CommunityVoiceModerationInput | MeetingModerationInput): Promise<VoiceModerationResult> {
    if (dataSourceService.getStatus().isMock) return { ok: true, action: input.action };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Voice moderation is unavailable." };
    const { data, error } = await client.functions.invoke<EdgeResponse>("livekit-moderation", { headers: getApiCompatibilityRequestHeaders(), body: input });
    if (error || !data?.ok || data.action !== input.action) return { ok: false, message: data?.message || "The voice moderation action was denied or could not be completed." };
    return { ok: true, action: input.action };
  },
};
