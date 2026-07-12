import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { createLiveKitToken } from "../_shared/livekit-token.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { createPicomLiveKitRoomName, matchesPicomLiveKitRoomName } from "../_shared/livekit-room.ts";

type LiveKitIntent = "voice" | "screen";
type LiveKitTokenRequest = { communityId?: string; channelId?: string; roomName?: string; participantName?: string; intent?: LiveKitIntent };
type AuthorizationRow = { community_id: string; channel_id: string; community_kind: string; channel_private: boolean; can_publish_audio: boolean; can_publish_screen: boolean };
type CanonicalProfile = { id: string; display_name: string; deletion_requested_at: string | null; is_bot: boolean };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const participantNamePattern = /^[^\u0000-\u001f\u007f]{1,80}$/;
const maxBodyBytes = 2048;
const tokenTtlSeconds = 10 * 60;
const allowedRequestKeys = new Set(["communityId", "channelId", "roomName", "participantName", "intent"]);

function getRequiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim().length > 0 ? value.trim() : null;
}

function isV1VoiceScreenEnabled(): boolean {
  return getRequiredEnv("PICOM_V1_VOICE_SCREEN_ENABLED")?.toLowerCase() === "true";
}

function isSafeLiveKitUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return false;
    if (url.protocol === "wss:") return true;
    return url.protocol === "ws:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch {
    return false;
  }
}

function getAllowedOrigins(): Set<string> {
  const configured = getRequiredEnv("PICOM_ALLOWED_ORIGINS");
  return new Set((configured ?? "").split(",").map((value) => value.trim()).filter(Boolean));
}

function corsHeadersFor(request: Request, allowedOrigins: ReadonlySet<string>): HeadersInit | null {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return null;
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
  return value === "voice" || value === "screen" ? value : null;
}

Deno.serve(async (request: Request) => {
  const allowedOrigins = getAllowedOrigins();
  if (!allowedOrigins.size) return new Response(JSON.stringify({ code: "VOICE_NOT_CONFIGURED", message: "Voice service is not configured." }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

  const corsHeaders = corsHeadersFor(request, allowedOrigins);
  if (!corsHeaders) return new Response(JSON.stringify({ code: "VALIDATION_ERROR", message: "Origin is not allowed." }), { status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  const respond = (response: Response) => withCors(response, corsHeaders);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return respond(methodNotAllowed(["POST", "OPTIONS"]));

  const parsed = await readValidatedBody(request);
  if (!parsed.ok) return respond(parsed.response);
  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return respond(auth.response);
  if (!isV1VoiceScreenEnabled()) return respond(errorResponse("VOICE_NOT_CONFIGURED", "Voice service is not enabled for this release.", 503));

  const { data: profileRow, error: profileError } = await auth.supabase
    .from("profiles")
    .select("id,display_name,deletion_requested_at,is_bot")
    .eq("id", auth.user.id)
    .maybeSingle();
  const profile = profileRow as CanonicalProfile | null;
  if (profileError || !profile || profile.id !== auth.user.id || profile.deletion_requested_at || profile.is_bot) {
    return respond(errorResponse("VOICE_CHANNEL_FORBIDDEN", "You cannot join this voice channel.", 403));
  }
  const canonicalParticipantName = profile.display_name.trim().slice(0, 80);
  if (!participantNamePattern.test(canonicalParticipantName)) return respond(errorResponse("VOICE_CHANNEL_FORBIDDEN", "Your profile cannot join voice yet.", 403));

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
  if (!livekitUrl || !isSafeLiveKitUrl(livekitUrl) || !livekitApiKey || !livekitApiSecret) return respond(errorResponse("VOICE_NOT_CONFIGURED", "Voice service is not configured.", 503));

  const { communityId, channelId } = parsed.body;
  const intent = parseIntent(parsed.body.intent);
  const communityIdValid = typeof communityId === "string" && uuidPattern.test(communityId);
  const channelIdValid = typeof channelId === "string" && uuidPattern.test(channelId);
  if (!communityIdValid || !channelIdValid) return respond(errorResponse("VALIDATION_ERROR", "A valid communityId and channelId are required.", 400, {
    communityIdPresent: typeof communityId === "string",
    communityIdValid,
    channelIdPresent: typeof channelId === "string",
    channelIdValid,
  }));
  const validatedCommunityId = communityId as string;
  const validatedChannelId = channelId as string;
  if (!intent) return respond(errorResponse("VALIDATION_ERROR", "intent must be voice or screen.", 400));
  if (parsed.body.participantName !== undefined && (typeof parsed.body.participantName !== "string" || !participantNamePattern.test(parsed.body.participantName.trim()))) return respond(errorResponse("VALIDATION_ERROR", "participantName must contain 1-80 safe characters.", 400));

  const { data: authorizationRows, error: authorizationError } = await auth.supabase.rpc("authorize_livekit_room", { target_community_id: validatedCommunityId, target_channel_id: validatedChannelId, target_intent: intent });
  const authorization = Array.isArray(authorizationRows) ? authorizationRows[0] as AuthorizationRow | undefined : undefined;
  if (authorizationError || !authorization) return respond(errorResponse("VOICE_CHANNEL_FORBIDDEN", "You cannot join this voice channel.", 403));

  const roomName = createPicomLiveKitRoomName(validatedCommunityId, validatedChannelId);
  if (parsed.body.roomName && !matchesPicomLiveKitRoomName(parsed.body.roomName, validatedCommunityId, validatedChannelId)) return respond(errorResponse("VALIDATION_ERROR", "roomName does not match the requested community/channel.", 400));

  const canPublish = intent === "screen" ? authorization.can_publish_screen : authorization.can_publish_audio;
  const publishSources: Array<"microphone" | "screen_share" | "screen_share_audio"> = intent === "screen"
    ? canPublish ? [...(authorization.can_publish_audio ? ["microphone" as const] : []), "screen_share", "screen_share_audio"] : []
    : canPublish ? ["microphone"] : [];
  const { token, expiresAt } = await createLiveKitToken({ apiKey: livekitApiKey, apiSecret: livekitApiSecret, identity: auth.user.id, name: canonicalParticipantName, roomName, ttlSeconds: tokenTtlSeconds, canPublish, canSubscribe: true, canPublishData: false, canPublishSources: publishSources });
  return respond(jsonResponse({ token, url: livekitUrl, roomName, identity: auth.user.id, participantName: canonicalParticipantName, intent, canPublishAudio: authorization.can_publish_audio, canPublishScreen: authorization.can_publish_screen, expiresAt }));
});
