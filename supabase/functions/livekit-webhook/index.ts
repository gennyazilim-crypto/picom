import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { verifyLiveKitWebhook } from "../_shared/livekit-webhook-verifier.ts";

type LiveKitWebhookEvent = {
  id?: unknown; event?: unknown; createdAt?: unknown;
  room?: { name?: unknown };
  participant?: { identity?: unknown; name?: unknown };
  track?: { sid?: unknown; type?: unknown; source?: unknown };
};

const maxBodyBytes = 256 * 1024;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const meetingRoomPattern = /^meeting:([0-9a-f-]{36}):session:([0-9a-f-]{36})$/i;
const handledEvents = new Set(["room_started", "room_finished", "participant_joined", "participant_left", "participant_connection_aborted", "track_published", "track_unpublished"]);
const ignoredEvents = new Set(["egress_started", "egress_updated", "egress_ended", "ingress_started", "ingress_ended"]);

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

function trackKind(value: unknown): "audio" | "video" | null {
  if (value === 0 || String(value).toLowerCase() === "audio") return "audio";
  if (value === 1 || String(value).toLowerCase() === "video") return "video";
  return null;
}

function trackSource(value: unknown): "microphone" | "camera" | "screen_share" | "screen_share_audio" | "unknown" {
  const normalized = String(value).toLowerCase();
  if (value === 1 || normalized === "camera") return "camera";
  if (value === 2 || normalized === "microphone") return "microphone";
  if (value === 3 || normalized === "screen_share" || normalized === "screenshare") return "screen_share";
  if (value === 4 || normalized === "screen_share_audio" || normalized === "screenshareaudio") return "screen_share_audio";
  return "unknown";
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/webhook+json") return errorResponse("VALIDATION_ERROR", "LiveKit webhooks must use application/webhook+json.", 415);
  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) return errorResponse("VALIDATION_ERROR", "Webhook payload is too large.", 413);
  const rawBody = await request.text();
  if (!rawBody || new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) return errorResponse("VALIDATION_ERROR", "Webhook payload is empty or too large.", rawBody ? 413 : 400);
  const apiKey = requiredEnv("LIVEKIT_API_KEY");
  const apiSecret = requiredEnv("LIVEKIT_API_SECRET");
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !apiSecret || !supabaseUrl || !serviceRoleKey) return errorResponse("INTERNAL_ERROR", "LiveKit webhook processing is not configured.", 503);

  let digest: string;
  try {
    digest = (await verifyLiveKitWebhook(rawBody, request.headers.get("Authorization"), apiKey, apiSecret)).payloadDigestHex;
  } catch {
    return errorResponse("WEBHOOK_INVALID", "LiveKit webhook authentication failed.", 401);
  }
  let event: LiveKitWebhookEvent;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    event = parsed as LiveKitWebhookEvent;
  } catch {
    return errorResponse("VALIDATION_ERROR", "LiveKit webhook JSON is invalid.", 400);
  }
  const eventId = typeof event.id === "string" ? event.id.toLowerCase() : "";
  const eventType = typeof event.event === "string" ? event.event : "";
  const createdAtSeconds = Number(event.createdAt);
  if (!uuidPattern.test(eventId) || !Number.isFinite(createdAtSeconds) || (!handledEvents.has(eventType) && !ignoredEvents.has(eventType))) return errorResponse("VALIDATION_ERROR", "LiveKit webhook event metadata is invalid.", 400);
  if (ignoredEvents.has(eventType)) return jsonResponse({ accepted: true, ignored: true, eventId, eventType });
  const roomName = typeof event.room?.name === "string" ? event.room.name : "";
  const roomMatch = meetingRoomPattern.exec(roomName);
  if (!roomMatch || !uuidPattern.test(roomMatch[1]) || !uuidPattern.test(roomMatch[2])) return errorResponse("VALIDATION_ERROR", "Webhook room is not a canonical Picom meeting room.", 400);
  const participantIdentity = typeof event.participant?.identity === "string" ? event.participant.identity.slice(0, 180) : null;
  const participantName = typeof event.participant?.name === "string" ? event.participant.name.slice(0, 120) : null;
  const trackSid = typeof event.track?.sid === "string" ? event.track.sid.slice(0, 180) : null;
  const kind = eventType.startsWith("track_") ? trackKind(event.track?.type) : null;
  const source = eventType.startsWith("track_") ? trackSource(event.track?.source) : null;
  if ((eventType.startsWith("participant_") || eventType.startsWith("track_")) && !participantIdentity) return errorResponse("VALIDATION_ERROR", "Webhook participant identity is missing.", 400);
  if (eventType.startsWith("track_") && (!trackSid || !kind)) return errorResponse("VALIDATION_ERROR", "Webhook track metadata is invalid.", 400);

  const operator = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await operator.rpc("process_livekit_webhook_event", {
    target_event_id: eventId,
    target_event_type: eventType,
    target_occurred_at: new Date(createdAtSeconds * 1000).toISOString(),
    target_room_id: roomMatch[1],
    target_session_id: roomMatch[2],
    target_room_name: roomName,
    target_payload_digest: digest,
    target_participant_identity: participantIdentity,
    target_participant_name: participantName,
    target_track_sid: trackSid,
    target_track_kind: kind,
    target_track_source: source,
  });
  if (error || !data || typeof data !== "object") return errorResponse("INTERNAL_ERROR", "LiveKit webhook processing is temporarily unavailable.", 503, undefined, { "Retry-After": "30" });
  const result = data as { processed?: boolean; duplicate?: boolean; errorCode?: string };
  if (!result.processed) {
    const replay = result.errorCode === "WEBHOOK_REPLAY_MISMATCH";
    return errorResponse(replay ? "WEBHOOK_INVALID" : "INTERNAL_ERROR", replay ? "Webhook replay digest does not match." : "Webhook processing requires retry.", replay ? 409 : 503, undefined, replay ? undefined : { "Retry-After": "30" });
  }
  return jsonResponse({ accepted: true, duplicate: result.duplicate === true, eventId, eventType });
});
