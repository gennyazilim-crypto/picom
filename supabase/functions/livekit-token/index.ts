import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { createLiveKitToken } from "../_shared/livekit-token.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { createPicomDirectLiveKitRoomName, createPicomLiveKitRoomName, matchesPicomDirectCallLiveKitRoomName, matchesPicomDirectLiveKitRoomName, matchesPicomLiveKitRoomName } from "../_shared/livekit-room.ts";

type LiveKitIntent = "voice" | "video" | "screen";
type LiveKitTokenRequest = { communityId?: string; channelId?: string; conversationId?: string; callId?: string; roomName?: string; participantName?: string; intent?: LiveKitIntent };
type AuthorizationRow = { community_id: string; channel_id: string; community_kind: string; channel_private: boolean; can_publish_audio: boolean; can_publish_screen: boolean };
type DirectAuthorizationRow = { conversation_id: string; can_publish_audio: boolean; can_publish_screen: boolean };
type DirectCallAuthorizationRow = { conversation_id: string; room_name: string; can_publish_audio: boolean; can_publish_video: boolean; can_publish_screen: boolean };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const participantNamePattern = /^[^\u0000-\u001f\u007f]{1,80}$/;
const maxBodyBytes = 2048;
const tokenTtlSeconds = 60 * 60;
const allowedRequestKeys = new Set(["communityId", "channelId", "conversationId", "callId", "roomName", "participantName", "intent"]);

function getRequiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim().length > 0 ? value.trim() : null;
}

function getAllowedOrigins(): Set<string> {
  const configured = getRequiredEnv("PICOM_ALLOWED_ORIGINS") ?? "http://127.0.0.1:5173,http://localhost:5173";
  return new Set(configured.split(",").map((value) => value.trim()).filter(Boolean));
}

function corsHeadersFor(request: Request): HeadersInit | null {
  const origin = request.headers.get("Origin");
  if (origin && !getAllowedOrigins().has(origin)) return null;
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-picom-api-version, x-picom-client-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  };
}

function withCors(response: Response, headers: HeadersInit): Response {
  const next = new Headers(response.headers);
  next.delete("Access-Control-Allow-Origin");
  for (const [key, value] of new Headers(headers)) next.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: next });
}

async function readValidatedBody(request: Request): Promise<{ ok: true; body: LiveKitTokenRequest } | { ok: false; response: Response }> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) return { ok: false, response: errorResponse("VALIDATION_ERROR", "Content-Type must be application/json.", 415) };
  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) return { ok: false, response: errorResponse("VALIDATION_ERROR", "Request body is too large.", 413) };
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > maxBodyBytes) return { ok: false, response: errorResponse("VALIDATION_ERROR", "Request body is empty or too large.", text ? 413 : 400) };
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some((key) => !allowedRequestKeys.has(key))) throw new Error("invalid shape");
    return { ok: true, body: parsed as LiveKitTokenRequest };
  } catch {
    return { ok: false, response: errorResponse("VALIDATION_ERROR", "Request body must be a supported JSON object.", 400) };
  }
}

function parseIntent(value: unknown): LiveKitIntent | null {
  if (value === undefined || value === null) return "voice";
  return value === "voice" || value === "video" || value === "screen" ? value : null;
}

Deno.serve(async (request: Request) => {
  const corsHeaders = corsHeadersFor(request);
  if (!corsHeaders) return new Response(JSON.stringify({ code: "VALIDATION_ERROR", message: "Origin is not allowed." }), { status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const respond = (response: Response) => withCors(response, corsHeaders);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return respond(methodNotAllowed(["POST", "OPTIONS"]));

  const parsed = await readValidatedBody(request);
  if (!parsed.ok) return respond(parsed.response);
  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return respond(auth.response);

  const { data: limitRows, error: limitError } = await auth.supabase.rpc("consume_current_user_action_rate_limit", { target_action: "livekit_token" });
  if (limitError) return respond(errorResponse("INTERNAL_ERROR", "Voice authorization is temporarily unavailable.", 503, undefined, { "Retry-After": "30" }));
  const limit = Array.isArray(limitRows) ? limitRows[0] as { is_allowed?: boolean; retry_after_seconds?: number } | undefined : undefined;
  if (!limit?.is_allowed) {
    const retryAfter = Math.min(Math.max(Number(limit?.retry_after_seconds) || 60, 1), 3600);
    return respond(errorResponse("RATE_LIMITED", "Too many voice token requests. Please wait and try again.", 429, undefined, { "Retry-After": String(retryAfter) }));
  }

  const livekitUrl = getRequiredEnv("LIVEKIT_URL");
  const livekitApiKey = getRequiredEnv("LIVEKIT_API_KEY");
  const livekitApiSecret = getRequiredEnv("LIVEKIT_API_SECRET");
  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) return respond(errorResponse("VOICE_NOT_CONFIGURED", "Voice service is not configured.", 503));

  const intent = parseIntent(parsed.body.intent);
  if (!intent) return respond(errorResponse("VALIDATION_ERROR", "intent must be voice, video, or screen.", 400));
  if (parsed.body.participantName !== undefined && (typeof parsed.body.participantName !== "string" || !participantNamePattern.test(parsed.body.participantName.trim()))) return respond(errorResponse("VALIDATION_ERROR", "participantName must contain 1-80 safe characters.", 400));

  const displayName = typeof auth.user.user_metadata?.display_name === "string" ? auth.user.user_metadata.display_name : auth.user.email?.split("@")[0] ?? "Picom user";
  const participantName = parsed.body.participantName?.trim() || displayName.slice(0, 80);

  const { communityId, channelId, conversationId, callId } = parsed.body;
  let roomName: string;
  let canPublishAudio: boolean;
  let canPublishVideo: boolean;
  let canPublishScreen: boolean;

  if (callId !== undefined) {
    if (communityId || channelId || !uuidPattern.test(callId) || (conversationId !== undefined && !uuidPattern.test(conversationId))) {
      return respond(errorResponse("VALIDATION_ERROR", "A direct call requires a valid callId and optional matching conversationId.", 400));
    }
    const { data: callRows, error: callError } = await auth.supabase.rpc("authorize_direct_call_livekit", { target_call_id: callId, target_intent: intent });
    const callAuthorization = Array.isArray(callRows) ? callRows[0] as DirectCallAuthorizationRow | undefined : undefined;
    if (callError || !callAuthorization) return respond(errorResponse("VOICE_DIRECT_FORBIDDEN", "This direct call is unavailable or has ended.", 403));
    if (conversationId && callAuthorization.conversation_id !== conversationId) return respond(errorResponse("VALIDATION_ERROR", "callId does not belong to the requested conversation.", 400));
    roomName = callAuthorization.room_name;
    if (!matchesPicomDirectCallLiveKitRoomName(roomName, callId)) return respond(errorResponse("INTERNAL_ERROR", "The direct call room name is invalid.", 503));
    if (parsed.body.roomName && parsed.body.roomName !== roomName) return respond(errorResponse("VALIDATION_ERROR", "roomName does not match the requested call.", 400));
    canPublishAudio = callAuthorization.can_publish_audio;
    canPublishVideo = callAuthorization.can_publish_video;
    canPublishScreen = callAuthorization.can_publish_screen;
  } else if (conversationId !== undefined) {
    // Direct (1:1) DM call: authorize by conversation participation, not community.
    if (communityId || channelId || !uuidPattern.test(conversationId)) return respond(errorResponse("VALIDATION_ERROR", "A direct call requires only a valid conversationId.", 400));
    const { data: directRows, error: directError } = await auth.supabase.rpc("authorize_direct_livekit_room", { target_conversation_id: conversationId, target_intent: intent });
    const directAuthorization = Array.isArray(directRows) ? directRows[0] as DirectAuthorizationRow | undefined : undefined;
    if (directError || !directAuthorization) return respond(errorResponse("VOICE_DIRECT_FORBIDDEN", "You cannot start a voice call in this conversation.", 403));
    roomName = createPicomDirectLiveKitRoomName(conversationId);
    if (parsed.body.roomName && !matchesPicomDirectLiveKitRoomName(parsed.body.roomName, conversationId)) return respond(errorResponse("VALIDATION_ERROR", "roomName does not match the requested conversation.", 400));
    canPublishAudio = directAuthorization.can_publish_audio;
    canPublishVideo = false;
    canPublishScreen = directAuthorization.can_publish_screen;
  } else {
    if (!communityId || !channelId || !uuidPattern.test(communityId) || !uuidPattern.test(channelId)) return respond(errorResponse("VALIDATION_ERROR", "A valid communityId and channelId are required.", 400));
    const { data: authorizationRows, error: authorizationError } = await auth.supabase.rpc("authorize_livekit_room", { target_community_id: communityId, target_channel_id: channelId, target_intent: intent });
    const authorization = Array.isArray(authorizationRows) ? authorizationRows[0] as AuthorizationRow | undefined : undefined;
    if (authorizationError || !authorization) return respond(errorResponse("VOICE_CHANNEL_FORBIDDEN", "You cannot join this voice channel.", 403));
    roomName = createPicomLiveKitRoomName(communityId, channelId);
    if (parsed.body.roomName && !matchesPicomLiveKitRoomName(parsed.body.roomName, communityId, channelId)) return respond(errorResponse("VALIDATION_ERROR", "roomName does not match the requested community/channel.", 400));
    canPublishAudio = authorization.can_publish_audio;
    canPublishVideo = false;
    canPublishScreen = authorization.can_publish_screen;
  }

  const canPublish = intent === "screen" ? canPublishScreen : intent === "video" ? canPublishVideo : canPublishAudio;
  const publishSources: Array<"microphone" | "camera" | "screen_share" | "screen_share_audio"> = intent === "screen"
    ? canPublish ? [...(canPublishAudio ? ["microphone" as const] : []), ...(canPublishVideo ? ["camera" as const] : []), "screen_share", "screen_share_audio"] : []
    : intent === "video"
      ? canPublish ? [...(canPublishAudio ? ["microphone" as const] : []), "camera"] : []
      : canPublish ? ["microphone"] : [];
  const { token, expiresAt } = await createLiveKitToken({ apiKey: livekitApiKey, apiSecret: livekitApiSecret, identity: auth.user.id, name: participantName, roomName, ttlSeconds: tokenTtlSeconds, canPublish, canSubscribe: true, canPublishData: true, canPublishSources: publishSources });
  return respond(jsonResponse({ token, url: livekitUrl, roomName, identity: auth.user.id, participantName, intent, canPublishAudio, canPublishVideo, canPublishScreen, expiresAt }));
});
