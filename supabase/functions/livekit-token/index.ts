import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { createLiveKitToken } from "../_shared/livekit-token.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { createPicomLiveKitRoomName, matchesPicomLiveKitRoomName } from "../_shared/livekit-room.ts";

type LiveKitIntent = "voice" | "screen";

type LiveKitTokenRequest = {
  communityId?: string;
  channelId?: string;
  roomName?: string;
  participantName?: string;
  intent?: LiveKitIntent;
};

type ChannelRow = {
  id: string;
  community_id: string;
  name: string;
  type: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const maxParticipantNameLength = 80;

function getRequiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim().length > 0 ? value : null;
}

async function readJsonBody(request: Request): Promise<LiveKitTokenRequest | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function parseIntent(value: unknown): LiveKitIntent | null {
  if (value === undefined || value === null) return "voice";
  return value === "voice" || value === "screen" ? value : null;
}

Deno.serve(async (request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  if (request.method !== "POST") {
    return methodNotAllowed(["POST", "OPTIONS"]);
  }

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const livekitUrl = getRequiredEnv("LIVEKIT_URL");
  const livekitApiKey = getRequiredEnv("LIVEKIT_API_KEY");
  const livekitApiSecret = getRequiredEnv("LIVEKIT_API_SECRET");

  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    return errorResponse("VOICE_NOT_CONFIGURED", "Voice service is not configured.", 503);
  }

  const body = await readJsonBody(request);
  const communityId = body?.communityId;
  const channelId = body?.channelId;
  const intent = parseIntent(body?.intent);

  if (!communityId || !channelId || !uuidPattern.test(communityId) || !uuidPattern.test(channelId)) {
    return errorResponse("VALIDATION_ERROR", "A valid communityId and channelId are required.", 400);
  }

  if (!intent) {
    return errorResponse("VALIDATION_ERROR", "intent must be voice or screen.", 400);
  }

  const { data: channel, error: channelError } = await auth.supabase
    .from("channels")
    .select("id, community_id, name, type")
    .eq("id", channelId)
    .eq("community_id", communityId)
    .single<ChannelRow>();

  if (channelError || !channel) {
    return errorResponse("VOICE_CHANNEL_FORBIDDEN", "You cannot join this voice channel.", 403);
  }

  if (channel.type !== "voice") {
    return errorResponse("VOICE_CHANNEL_REQUIRED", "Select a voice channel before joining voice.", 400);
  }

  const displayName = typeof auth.user.user_metadata?.display_name === "string" ? auth.user.user_metadata.display_name : auth.user.email?.split("@")[0] ?? "Picom user";
  const participantName = typeof body?.participantName === "string" && body.participantName.trim()
    ? body.participantName.trim().slice(0, maxParticipantNameLength)
    : displayName;
  const roomName = createPicomLiveKitRoomName(communityId, channelId);

  if (body?.roomName && !matchesPicomLiveKitRoomName(body.roomName, communityId, channelId)) {
    return errorResponse("VALIDATION_ERROR", "roomName does not match the requested community/channel.", 400);
  }

  const { token, expiresAt } = await createLiveKitToken({
    apiKey: livekitApiKey,
    apiSecret: livekitApiSecret,
    identity: auth.user.id,
    name: participantName,
    roomName,
    ttlSeconds: 60 * 60,
  });

  return jsonResponse({
    token,
    url: livekitUrl,
    roomName,
    identity: auth.user.id,
    participantName,
    intent,
    expiresAt,
  });
});
