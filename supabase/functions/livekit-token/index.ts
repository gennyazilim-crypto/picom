import { handleCorsPreflight } from "../_shared/cors.ts";
import { jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { createLiveKitToken } from "../_shared/livekit-token.ts";
import { requireSupabaseUser } from "../_shared/supabase-auth.ts";

type LiveKitTokenRequest = {
  communityId?: string;
  channelId?: string;
};

type ChannelRow = {
  id: string;
  community_id: string;
  name: string;
  type: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    return jsonResponse({ code: "VOICE_NOT_CONFIGURED", message: "Voice service is not configured." }, { status: 503 });
  }

  const body = await readJsonBody(request);
  const communityId = body?.communityId;
  const channelId = body?.channelId;

  if (!communityId || !channelId || !uuidPattern.test(communityId) || !uuidPattern.test(channelId)) {
    return jsonResponse({ code: "VALIDATION_ERROR", message: "A valid communityId and channelId are required." }, { status: 400 });
  }

  const { data: channel, error: channelError } = await auth.supabase
    .from("channels")
    .select("id, community_id, name, type")
    .eq("id", channelId)
    .eq("community_id", communityId)
    .single<ChannelRow>();

  if (channelError || !channel) {
    return jsonResponse({ code: "VOICE_CHANNEL_FORBIDDEN", message: "You cannot join this voice channel." }, { status: 403 });
  }

  if (channel.type !== "voice") {
    return jsonResponse({ code: "VOICE_CHANNEL_REQUIRED", message: "Select a voice channel before joining voice." }, { status: 400 });
  }

  const displayName = typeof auth.user.user_metadata?.display_name === "string" ? auth.user.user_metadata.display_name : auth.user.email?.split("@")[0] ?? "Picom user";
  const roomName = `picom:${communityId}:${channelId}`;
  const { token, expiresAt } = await createLiveKitToken({
    apiKey: livekitApiKey,
    apiSecret: livekitApiSecret,
    identity: auth.user.id,
    name: displayName,
    roomName,
  });

  return jsonResponse({
    token,
    url: livekitUrl,
    roomName,
    identity: auth.user.id,
    expiresAt,
  });
});
