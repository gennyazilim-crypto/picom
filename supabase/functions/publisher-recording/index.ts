import { EgressClient, EncodedFileOutput, EncodedFileType } from "npm:livekit-server-sdk@2.17.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { createPicomPublisherStreamLiveKitRoomName } from "../_shared/livekit-room.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

type Body = {
  action?: "start" | "stop" | "sign_playback";
  streamId?: string;
  replayId?: string;
  clientRequestId?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedKeys = new Set(["action", "streamId", "replayId", "clientRequestId"]);
const env = (name: string): string | null => Deno.env.get(name)?.trim() || null;
const serviceUrl = (value: string): string => value.replace(/^wss:/, "https:").replace(/^ws:/, "http:");

function recordingInfrastructureReady(): { ok: true } | { ok: false; code: string; message: string } {
  // Egress FileOutput requires S3-compatible credentials. Without them, fail closed.
  const s3Key = env("PICOM_RECORDING_S3_ACCESS_KEY");
  const s3Secret = env("PICOM_RECORDING_S3_SECRET_KEY");
  const s3Bucket = env("PICOM_RECORDING_S3_BUCKET");
  const s3Endpoint = env("PICOM_RECORDING_S3_ENDPOINT");
  const egressEnabled = env("PICOM_LIVEKIT_EGRESS_ENABLED");
  if (egressEnabled !== "true" && egressEnabled !== "1") {
    return { ok: false, code: "EGRESS_NOT_DEPLOYED", message: "LiveKit Egress is not enabled for this environment." };
  }
  if (!s3Key || !s3Secret || !s3Bucket) {
    return { ok: false, code: "STORAGE_CREDENTIAL_MISSING", message: "Recording object storage credentials are not configured." };
  }
  if (!s3Endpoint) {
    return { ok: false, code: "STORAGE_ENDPOINT_MISSING", message: "Recording object storage endpoint is not configured." };
  }
  return { ok: true };
}

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const parsed = await readBoundedJsonObject<Body>(request, { maxBytes: 4096, allowedKeys });
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const action = body.action;
  if (!action || !["start", "stop", "sign_playback"].includes(action)) {
    return errorResponse("VALIDATION_ERROR", "Valid action is required.", 400);
  }

  const supabaseUrl = env("SUPABASE_URL");
  const serviceRole = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return errorResponse("INTERNAL_ERROR", "Recording service is not configured.", 503);
  }
  const operator = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  if (action === "sign_playback") {
    if (!body.replayId || !uuidPattern.test(body.replayId)) {
      return errorResponse("VALIDATION_ERROR", "Valid replayId is required.", 400);
    }
    const { data, error } = await auth.supabase.rpc("create_publisher_replay_playback_url", {
      target_replay_id: body.replayId,
      ttl_seconds: 300,
    });
    if (error || !data) {
      return errorResponse("MEETING_ACCESS_DENIED", "Playback is not authorized for this replay.", 403);
    }
    const claim = data as { bucket?: string; path?: string; ttl_seconds?: number; content_type?: string };
    if (!claim.bucket || !claim.path) {
      return errorResponse("VALIDATION_ERROR", "Replay media is not available.", 409);
    }
    const ttl = Math.min(Math.max(Number(claim.ttl_seconds) || 300, 60), 900);
    const signed = await operator.storage.from(claim.bucket).createSignedUrl(claim.path, ttl);
    if (signed.error || !signed.data?.signedUrl) {
      return errorResponse("INTERNAL_ERROR", "Signed playback URL could not be created.", 503);
    }
    return jsonResponse({
      ok: true,
      url: signed.data.signedUrl,
      expiresInSeconds: ttl,
      contentType: claim.content_type ?? "video/mp4",
    });
  }

  if (!body.streamId || !uuidPattern.test(body.streamId)) {
    return errorResponse("VALIDATION_ERROR", "Valid streamId is required.", 400);
  }

  if (action === "stop") {
    const { data, error } = await auth.supabase.rpc("request_stop_publisher_stream_recording", {
      target_stream_id: body.streamId,
    });
    if (error || !data) {
      return errorResponse("VALIDATION_ERROR", error?.message ?? "Stop recording failed.", 400);
    }
    const stop = data as { provider_egress_id?: string | null; recording_id?: string; status?: string; stopped?: boolean };
    const infra = recordingInfrastructureReady();
    const livekitUrl = env("LIVEKIT_URL");
    const apiKey = env("LIVEKIT_API_KEY");
    const apiSecret = env("LIVEKIT_API_SECRET");
    if (infra.ok && stop.stopped && stop.provider_egress_id && livekitUrl && apiKey && apiSecret) {
      try {
        const egress = new EgressClient(serviceUrl(livekitUrl), apiKey, apiSecret);
        await egress.stopEgress(stop.provider_egress_id);
      } catch {
        // Idempotent stop: provider may already have ended.
      }
    }
    return jsonResponse({ ok: true, ...stop, providerInvoked: Boolean(infra.ok && stop.provider_egress_id) });
  }

  // start
  const infra = recordingInfrastructureReady();
  const { data, error } = await auth.supabase.rpc("request_publisher_stream_recording", {
    target_stream_id: body.streamId,
    client_request_id: body.clientRequestId && uuidPattern.test(body.clientRequestId) ? body.clientRequestId : null,
  });
  if (error || !data) {
    const message = error?.message ?? "Start recording failed.";
    if (message.includes("CAPACITY")) {
      return errorResponse("RATE_LIMITED", message, 429);
    }
    return errorResponse("VALIDATION_ERROR", message, 400);
  }

  const requested = data as {
    recording_id: string;
    status: string;
    already_active?: boolean;
    room_name?: string | null;
  };

  if (!infra.ok) {
    await operator.rpc("service_mark_publisher_recording_failed", {
      target_recording_id: requested.recording_id,
      target_failure_code: infra.code,
    });
    return errorResponse("INTERNAL_ERROR", infra.message, 503, {
      code: infra.code,
      recordingId: requested.recording_id,
      status: "FAILED",
    });
  }

  const livekitUrl = env("LIVEKIT_URL");
  const apiKey = env("LIVEKIT_API_KEY");
  const apiSecret = env("LIVEKIT_API_SECRET");
  if (!livekitUrl || !apiKey || !apiSecret) {
    await operator.rpc("service_mark_publisher_recording_failed", {
      target_recording_id: requested.recording_id,
      target_failure_code: "LIVEKIT_NOT_CONFIGURED",
    });
    return errorResponse("VOICE_NOT_CONFIGURED", "LiveKit is not configured.", 503);
  }

  const roomName = requested.room_name || createPicomPublisherStreamLiveKitRoomName(body.streamId);
  const filepath = `publishers/${auth.user.id}/streams/${body.streamId}/recordings/${requested.recording_id}/source.mp4`;
  try {
    const egress = new EgressClient(serviceUrl(livekitUrl), apiKey, apiSecret);
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath,
      output: {
        case: "s3",
        value: {
          accessKey: env("PICOM_RECORDING_S3_ACCESS_KEY")!,
          secret: env("PICOM_RECORDING_S3_SECRET_KEY")!,
          bucket: env("PICOM_RECORDING_S3_BUCKET")!,
          endpoint: env("PICOM_RECORDING_S3_ENDPOINT")!,
          region: env("PICOM_RECORDING_S3_REGION") ?? "auto",
          forcePathStyle: true,
        },
      },
    });
    const info = await egress.startRoomCompositeEgress(roomName, { file: output });
    const egressId = typeof info.egressId === "string" ? info.egressId : "";
    if (!egressId) throw new Error("missing egress id");
    await operator.rpc("service_bind_publisher_recording_egress", {
      target_recording_id: requested.recording_id,
      target_egress_id: egressId,
    });
    return jsonResponse({
      ok: true,
      recordingId: requested.recording_id,
      status: "STARTING",
      alreadyActive: Boolean(requested.already_active),
    });
  } catch {
    await operator.rpc("service_mark_publisher_recording_failed", {
      target_recording_id: requested.recording_id,
      target_failure_code: "EGRESS_START_FAILED",
    });
    return errorResponse("INTERNAL_ERROR", "Recording provider could not start.", 503);
  }
});
