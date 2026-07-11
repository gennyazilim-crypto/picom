import { getApiCompatibilityRequestHeaders } from "../../config/apiCompatibility";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import type { MeetingTokenRequest, MeetingTokenResponse, MeetingTokenResult } from "./meetingTokenTypes";

function fail(code: "MEETING_NOT_CONFIGURED" | "MEETING_TOKEN_FAILED" | "MEETING_TOKEN_INVALID_RESPONSE", message: string): MeetingTokenResult {
  return { ok: false, error: { code, message } };
}

function validRole(value: unknown): boolean {
  return typeof value === "string" && ["host", "cohost", "speaker", "participant", "viewer", "guest"].includes(value);
}

function isResponse(value: unknown): value is MeetingTokenResponse {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (!validRole(row.role) || typeof row.roomId !== "string" || typeof row.sessionId !== "string" || typeof row.communityId !== "string") return false;
  if (row.state === "waiting") return typeof row.waitingEntryId === "string" && row.canSubscribe === true && !("token" in row);
  return row.state === "authorized" && typeof row.token === "string" && row.token.length > 20 && typeof row.url === "string" && typeof row.roomName === "string" && typeof row.identity === "string" && typeof row.expiresAt === "string" && typeof row.canPublishAudio === "boolean" && typeof row.canPublishVideo === "boolean" && typeof row.canPublishScreen === "boolean" && typeof row.canPublishData === "boolean";
}

export const meetingTokenService = {
  async fetchToken(request: MeetingTokenRequest): Promise<MeetingTokenResult> {
    if (!request.roomId || !request.sessionId) return fail("MEETING_TOKEN_FAILED", "A meeting room and session are required.");
    if (dataSourceService.getStatus().isMock) return fail("MEETING_NOT_CONFIGURED", "Live meeting tokens require a configured Supabase and LiveKit staging or production environment.");
    const status = getSupabaseClientStatus();
    const client = getSupabaseClient();
    if (!status.configured || !client) return fail("MEETING_NOT_CONFIGURED", status.reason ?? "Supabase is not configured for meeting tokens.");
    const { data, error } = await client.functions.invoke<MeetingTokenResponse>("meeting-token", { headers: getApiCompatibilityRequestHeaders(), body: request }).catch(() => ({ data: null, error: new Error("Meeting token endpoint is unavailable.") }));
    if (error) return fail("MEETING_TOKEN_FAILED", "Picom could not authorize this meeting connection.");
    if (!isResponse(data)) return fail("MEETING_TOKEN_INVALID_RESPONSE", "Meeting authorization returned an invalid response.");
    return { ok: true, data };
  },
};
