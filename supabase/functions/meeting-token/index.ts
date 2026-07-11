import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { createLiveKitToken } from "../_shared/livekit-token.ts";
import { matchesPicomMeetingLiveKitRoomName } from "../_shared/livekit-room.ts";

type RequestedSources = { microphone?: boolean; camera?: boolean; screenShare?: boolean; data?: boolean };
type MeetingTokenRequest = { roomId?: string; sessionId?: string; requestedSources?: RequestedSources };
type AuthorizationRow = {
  room_id: string; session_id: string; community_id: string; provider_room_name: string;
  participant_identity: string; participant_name: string; meeting_role: "host" | "cohost" | "speaker" | "participant" | "viewer" | "guest";
  access_state: "authorized" | "waiting"; waiting_entry_id: string | null; can_subscribe: boolean;
  can_publish_audio: boolean; can_publish_video: boolean; can_publish_screen: boolean; can_publish_data: boolean;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const allowedKeys = new Set(["roomId", "sessionId", "requestedSources"]);
const allowedSourceKeys = new Set(["microphone", "camera", "screenShare", "data"]);
const maxBodyBytes = 2048;
const tokenTtlSeconds = 5 * 60;

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

function allowedOrigins(): Set<string> {
  return new Set((requiredEnv("PICOM_ALLOWED_ORIGINS") ?? "http://127.0.0.1:5173,http://localhost:5173").split(",").map((item) => item.trim()).filter(Boolean));
}

function corsHeadersFor(request: Request): HeadersInit | null {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins().has(origin)) return null;
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

async function readValidatedBody(request: Request): Promise<MeetingTokenRequest | null> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) return null;
  const declared = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBodyBytes) return null;
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > maxBodyBytes) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some((key) => !allowedKeys.has(key))) return null;
    const body = parsed as MeetingTokenRequest;
    const sources = body.requestedSources;
    if (sources !== undefined && (!sources || typeof sources !== "object" || Array.isArray(sources) || Object.keys(sources).some((key) => !allowedSourceKeys.has(key)) || Object.values(sources).some((value) => typeof value !== "boolean"))) return null;
    return body;
  } catch {
    return null;
  }
}

Deno.serve(async (request: Request) => {
  const cors = corsHeadersFor(request);
  if (!cors) return new Response(JSON.stringify({ code: "VALIDATION_ERROR", message: "Origin is not allowed." }), { status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const respond = (response: Response) => withCors(response, cors);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return respond(methodNotAllowed(["POST", "OPTIONS"]));
  const body = await readValidatedBody(request);
  if (!body || !body.roomId || !body.sessionId || !uuidPattern.test(body.roomId) || !uuidPattern.test(body.sessionId)) return respond(errorResponse("VALIDATION_ERROR", "Valid roomId, sessionId, and requestedSources are required.", 400));
  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return respond(auth.response);

  const requested = body.requestedSources ?? {};
  const { data, error } = await auth.supabase.rpc("authorize_livekit_meeting_token", {
    target_room_id: body.roomId,
    target_session_id: body.sessionId,
    request_audio: requested.microphone === true,
    request_video: requested.camera === true,
    request_screen: requested.screenShare === true,
    request_data: requested.data === true,
  });
  const authorization = Array.isArray(data) ? data[0] as AuthorizationRow | undefined : undefined;
  if (error || !authorization) {
    const message = error?.message ?? "";
    const limited = message.includes("RATE_LIMITED");
    const invalid = message.includes("NOT_OPEN") || message.includes("SESSION_UNAVAILABLE");
    return respond(errorResponse(limited ? "RATE_LIMITED" : "MEETING_ACCESS_DENIED", limited ? "Too many meeting token requests. Please wait and try again." : "You cannot join this meeting.", limited ? 429 : invalid ? 409 : 403, undefined, limited ? { "Retry-After": "60" } : undefined));
  }
  if (authorization.participant_identity !== auth.user.id || !matchesPicomMeetingLiveKitRoomName(authorization.provider_room_name, body.roomId, body.sessionId)) return respond(errorResponse("INTERNAL_ERROR", "Meeting authorization returned an invalid identity or room.", 503));
  if (authorization.access_state === "waiting") {
    return respond(jsonResponse({ state: "waiting", roomId: authorization.room_id, sessionId: authorization.session_id, communityId: authorization.community_id, role: authorization.meeting_role, waitingEntryId: authorization.waiting_entry_id, canSubscribe: true }, { status: 202 }));
  }

  const livekitUrl = requiredEnv("LIVEKIT_URL");
  const apiKey = requiredEnv("LIVEKIT_API_KEY");
  const apiSecret = requiredEnv("LIVEKIT_API_SECRET");
  if (!livekitUrl || !apiKey || !apiSecret) return respond(errorResponse("MEETING_NOT_CONFIGURED", "Meeting media service is not configured.", 503));
  const publishSources: Array<"camera" | "microphone" | "screen_share" | "screen_share_audio"> = [];
  if (authorization.can_publish_audio) publishSources.push("microphone");
  if (authorization.can_publish_video) publishSources.push("camera");
  if (authorization.can_publish_screen) publishSources.push("screen_share", "screen_share_audio");
  const { token, expiresAt } = await createLiveKitToken({ apiKey, apiSecret, identity: authorization.participant_identity, name: authorization.participant_name, roomName: authorization.provider_room_name, ttlSeconds: tokenTtlSeconds, canPublish: publishSources.length > 0, canSubscribe: authorization.can_subscribe, canPublishData: authorization.can_publish_data, canPublishSources: publishSources });
  return respond(jsonResponse({ state: "authorized", token, url: livekitUrl, roomId: authorization.room_id, sessionId: authorization.session_id, communityId: authorization.community_id, roomName: authorization.provider_room_name, identity: authorization.participant_identity, participantName: authorization.participant_name, role: authorization.meeting_role, canSubscribe: authorization.can_subscribe, canPublishAudio: authorization.can_publish_audio, canPublishVideo: authorization.can_publish_video, canPublishScreen: authorization.can_publish_screen, canPublishData: authorization.can_publish_data, expiresAt }));
});
