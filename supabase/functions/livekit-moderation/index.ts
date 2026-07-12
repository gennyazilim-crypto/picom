import { RoomServiceClient, TrackSource, TrackType } from "npm:livekit-server-sdk@2.17.0";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { createPicomLiveKitRoomName, matchesPicomMeetingLiveKitRoomName } from "../_shared/livekit-room.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

type Action = "mute" | "remove" | "deny_screen_share";
type Body = { scope?: "voice" | "meeting"; communityId?: string; channelId?: string; targetUserId?: string; roomId?: string; sessionId?: string; targetParticipantId?: string; action?: Action };
type AuthorizationRow = { community_id: string; channel_id: string; moderated_user_id: string; action: Action };
type MeetingAuthorizationRow = { provider_room_name: string; participant_identity: string; action: Action };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const allowedKeys = new Set(["scope", "communityId", "channelId", "targetUserId", "roomId", "sessionId", "targetParticipantId", "action"]);
const env = (name: string): string | null => Deno.env.get(name)?.trim() || null;
const serviceUrl = (value: string): string => value.replace(/^wss:/, "https:").replace(/^ws:/, "http:");

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);
  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;
  const parsed = await readBoundedJsonObject<Body>(request, { maxBytes: 2048, allowedKeys });
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const scope = body.scope ?? "voice";
  const meetingScope = scope === "meeting";
  if (meetingScope && (!body.roomId || !body.sessionId || !body.targetParticipantId || ![body.roomId, body.sessionId, body.targetParticipantId].every((value) => uuidPattern.test(value)))) return errorResponse("VALIDATION_ERROR", "Valid meeting room, session, and participant identifiers are required.", 400);
  if (!meetingScope && (!body.communityId || !body.channelId || !body.targetUserId || ![body.communityId, body.channelId, body.targetUserId].every((value) => uuidPattern.test(value)))) return errorResponse("VALIDATION_ERROR", "Valid community, channel, and target identifiers are required.", 400);
  if (!body.action || !["mute", "remove", "deny_screen_share"].includes(body.action) || (!meetingScope && body.action === "deny_screen_share")) return errorResponse("VALIDATION_ERROR", "The moderation action is not valid for this room.", 400);

  const { data: limitRows, error: limitError } = await auth.supabase.rpc("consume_current_user_action_rate_limit", { target_action: "livekit_token" });
  const limit = Array.isArray(limitRows) ? limitRows[0] as { is_allowed?: boolean; retry_after_seconds?: number } | undefined : undefined;
  if (limitError || !limit?.is_allowed) return errorResponse("RATE_LIMITED", "Voice moderation is temporarily unavailable. Try again shortly.", 429, undefined, { "Retry-After": String(Math.min(Math.max(Number(limit?.retry_after_seconds) || 30, 1), 3600)) });

  const authorizationResult = meetingScope
    ? await auth.supabase.rpc("authorize_livekit_meeting_moderation", { target_room_id: body.roomId, target_session_id: body.sessionId, target_participant_id: body.targetParticipantId, target_action: body.action })
    : await auth.supabase.rpc("authorize_livekit_voice_moderation", { target_community_id: body.communityId, target_channel_id: body.channelId, target_user_id: body.targetUserId, target_action: body.action });
  const rows = authorizationResult.data;
  const authorizationError = authorizationResult.error;
  const authorization = Array.isArray(rows) ? rows[0] as AuthorizationRow | MeetingAuthorizationRow | undefined : undefined;
  if (authorizationError || !authorization) return errorResponse("VOICE_MODERATION_FORBIDDEN", "You cannot moderate this voice participant.", 403);

  const url = env("LIVEKIT_URL"); const apiKey = env("LIVEKIT_API_KEY"); const apiSecret = env("LIVEKIT_API_SECRET");
  if (!url || !apiKey || !apiSecret) return errorResponse("VOICE_NOT_CONFIGURED", "Voice service is not configured.", 503);
  const meetingAuthorization = meetingScope ? authorization as MeetingAuthorizationRow : null;
  const roomName = meetingAuthorization?.provider_room_name ?? createPicomLiveKitRoomName(body.communityId!, body.channelId!);
  const providerIdentity = meetingAuthorization?.participant_identity ?? body.targetUserId!;
  if (meetingScope && !matchesPicomMeetingLiveKitRoomName(roomName, body.roomId!, body.sessionId!)) return errorResponse("INTERNAL_ERROR", "Meeting moderation returned an invalid provider room.", 503);
  const client = new RoomServiceClient(serviceUrl(url), apiKey, apiSecret);
  try {
    if (body.action === "remove") await client.removeParticipant(roomName, providerIdentity);
    else {
      const participant = await client.getParticipant(roomName, providerIdentity);
      const tracks = body.action === "mute"
        ? participant.tracks.filter((track) => track.type === TrackType.AUDIO && track.source === TrackSource.MICROPHONE)
        : participant.tracks.filter((track) => track.source === TrackSource.SCREEN_SHARE || track.source === TrackSource.SCREEN_SHARE_AUDIO);
      await Promise.all(tracks.map((track) => client.mutePublishedTrack(roomName, providerIdentity, track.sid, true)));
    }
  } catch { return errorResponse("VOICE_MODERATION_FAILED", "The participant is no longer available or the moderation action failed.", 409); }

  const { error: auditError } = meetingScope
    ? await auth.supabase.rpc("record_livekit_meeting_moderation", { target_room_id: body.roomId, target_session_id: body.sessionId, target_participant_id: body.targetParticipantId, target_action: body.action })
    : await auth.supabase.rpc("record_livekit_voice_moderation", { target_community_id: body.communityId, target_channel_id: body.channelId, target_user_id: body.targetUserId, target_action: body.action });
  if (auditError) return errorResponse("INTERNAL_ERROR", "The action completed, but its required audit record could not be confirmed.", 500);
  return jsonResponse({ ok: true, action: body.action });
});
