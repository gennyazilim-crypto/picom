import { RoomServiceClient } from "npm:livekit-server-sdk@2.17.0";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { createPicomLiveKitRoomName } from "../_shared/livekit-room.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

type Body = { communityId?: string; channelId?: string };
type AuthorizationRow = { community_id: string; channel_id: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedKeys = new Set(["communityId", "channelId"]);
const env = (name: string): string | null => Deno.env.get(name)?.trim() || null;
const serviceUrl = (value: string): string => value.replace(/^wss:/, "https:").replace(/^ws:/, "http:");

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const parsed = await readBoundedJsonObject<Body>(request, { maxBytes: 1024, allowedKeys });
  if (!parsed.ok) return parsed.response;

  const { communityId, channelId } = parsed.body;
  if (!communityId || !channelId || !uuidPattern.test(communityId) || !uuidPattern.test(channelId)) {
    return errorResponse("VALIDATION_ERROR", "A valid communityId and channelId are required.", 400);
  }

  const { data: authorizationRows, error: authorizationError } = await auth.supabase.rpc("authorize_livekit_room", {
    target_community_id: communityId,
    target_channel_id: channelId,
    target_intent: "voice",
  });
  const authorization = Array.isArray(authorizationRows) ? authorizationRows[0] as AuthorizationRow | undefined : undefined;
  if (authorizationError || !authorization) {
    return errorResponse("VOICE_CHANNEL_FORBIDDEN", "You cannot view occupancy for this voice channel.", 403);
  }

  const url = env("LIVEKIT_URL");
  const apiKey = env("LIVEKIT_API_KEY");
  const apiSecret = env("LIVEKIT_API_SECRET");
  if (!url || !apiKey || !apiSecret) {
    return errorResponse("VOICE_NOT_CONFIGURED", "Voice service is not configured.", 503);
  }

  const roomName = createPicomLiveKitRoomName(communityId, channelId);
  const client = new RoomServiceClient(serviceUrl(url), apiKey, apiSecret);

  try {
    const participants = await client.listParticipants(roomName);
    const mapped = participants.map((participant) => ({
      identity: String(participant.identity ?? "").slice(0, 180),
      name: String(participant.name || participant.identity || "Participant").slice(0, 120),
      isSpeaking: false,
      isMicrophoneEnabled: !(participant.permission && "canPublish" in participant.permission
        ? participant.permission.canPublish === false
        : false),
    })).filter((participant) => participant.identity.length > 0);

    return jsonResponse({
      communityId,
      channelId,
      roomName,
      participantCount: mapped.length,
      participantNames: mapped.map((participant) => participant.name),
      participants: mapped,
    });
  } catch {
    // Room not found / empty is a normal idle state for voice channels.
    return jsonResponse({
      communityId,
      channelId,
      roomName,
      participantCount: 0,
      participantNames: [],
      participants: [],
    });
  }
});
