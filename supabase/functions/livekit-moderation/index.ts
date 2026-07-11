import { RoomServiceClient, TrackType } from "npm:livekit-server-sdk@2.17.0";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { createPicomLiveKitRoomName } from "../_shared/livekit-room.ts";

type Action = "mute" | "remove";
type Body = { communityId?: string; channelId?: string; targetUserId?: string; action?: Action };
type AuthorizationRow = { community_id: string; channel_id: string; moderated_user_id: string; action: Action };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const allowedKeys = new Set(["communityId", "channelId", "targetUserId", "action"]);
const env = (name: string): string | null => Deno.env.get(name)?.trim() || null;
const serviceUrl = (value: string): string => value.replace(/^wss:/, "https:").replace(/^ws:/, "http:");

Deno.serve(async (request) => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  if (Number(request.headers.get("content-length") || "0") > 2048) return errorResponse("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
  let body: Body;
  try { body = await request.json() as Body; } catch { return errorResponse("VALIDATION_ERROR", "A JSON request body is required.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !allowedKeys.has(key))) return errorResponse("VALIDATION_ERROR", "Voice moderation request is invalid.", 400);
  if (!body.communityId || !body.channelId || !body.targetUserId || ![body.communityId, body.channelId, body.targetUserId].every((value) => uuidPattern.test(value))) return errorResponse("VALIDATION_ERROR", "Valid community, channel, and target identifiers are required.", 400);
  if (body.action !== "mute" && body.action !== "remove") return errorResponse("VALIDATION_ERROR", "action must be mute or remove.", 400);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;
  const { data: limitRows, error: limitError } = await auth.supabase.rpc("consume_current_user_action_rate_limit", { target_action: "livekit_token" });
  const limit = Array.isArray(limitRows) ? limitRows[0] as { is_allowed?: boolean; retry_after_seconds?: number } | undefined : undefined;
  if (limitError || !limit?.is_allowed) return errorResponse("RATE_LIMITED", "Voice moderation is temporarily unavailable. Try again shortly.", 429, undefined, { "Retry-After": String(Math.min(Math.max(Number(limit?.retry_after_seconds) || 30, 1), 3600)) });

  const { data: rows, error: authorizationError } = await auth.supabase.rpc("authorize_livekit_voice_moderation", { target_community_id: body.communityId, target_channel_id: body.channelId, target_user_id: body.targetUserId, target_action: body.action });
  const authorization = Array.isArray(rows) ? rows[0] as AuthorizationRow | undefined : undefined;
  if (authorizationError || !authorization) return errorResponse("VOICE_MODERATION_FORBIDDEN", "You cannot moderate this voice participant.", 403);

  const url = env("LIVEKIT_URL"); const apiKey = env("LIVEKIT_API_KEY"); const apiSecret = env("LIVEKIT_API_SECRET");
  if (!url || !apiKey || !apiSecret) return errorResponse("VOICE_NOT_CONFIGURED", "Voice service is not configured.", 503);
  const roomName = createPicomLiveKitRoomName(body.communityId, body.channelId);
  const client = new RoomServiceClient(serviceUrl(url), apiKey, apiSecret);
  try {
    if (body.action === "remove") await client.removeParticipant(roomName, body.targetUserId);
    else {
      const participant = await client.getParticipant(roomName, body.targetUserId);
      const audioTracks = participant.tracks.filter((track) => track.type === TrackType.AUDIO);
      await Promise.all(audioTracks.map((track) => client.mutePublishedTrack(roomName, body.targetUserId!, track.sid, true)));
    }
  } catch { return errorResponse("VOICE_MODERATION_FAILED", "The participant is no longer available or the moderation action failed.", 409); }

  const { error: auditError } = await auth.supabase.rpc("record_livekit_voice_moderation", { target_community_id: body.communityId, target_channel_id: body.channelId, target_user_id: body.targetUserId, target_action: body.action });
  if (auditError) return errorResponse("INTERNAL_ERROR", "The action completed, but its required audit record could not be confirmed.", 500);
  return jsonResponse({ ok: true, action: body.action });
});
