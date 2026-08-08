import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import {
  createPicomPublisherStreamLiveKitRoomName,
  matchesPicomPublisherStreamLiveKitRoomName,
} from "../_shared/livekit-room.ts";
import { createLiveKitIngressAdminToken } from "../_shared/livekit-token.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

type IngressAction = "create" | "delete" | "get" | "provisionForStream";
type IngressRequestBody = {
  action?: IngressAction;
  streamId?: string;
  roomName?: string;
};

type PublisherStreamRow = {
  id: string;
  owner_user_id: string;
  ingest_mode: string;
  room_name: string | null;
  status: string;
};

type CredentialRow = {
  id: string;
  stream_id: string;
  provider_ingress_id: string | null;
  ingest_url: string | null;
  status: string;
};

type LiveKitIngressInfo = {
  ingress_id?: unknown;
  ingressId?: unknown;
  name?: unknown;
  url?: unknown;
  stream_key?: unknown;
  streamKey?: unknown;
  room_name?: unknown;
  roomName?: unknown;
  state?: { status?: unknown };
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedKeys = new Set(["action", "streamId", "roomName"]);
const maxBodyBytes = 2048;
const maxIngressNameLength = 64;
const rtmpInputType = 0;

function env(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value ? value : null;
}

function liveKitHttpBase(liveKitUrl: string): string | null {
  try {
    const url = new URL(liveKitUrl);
    if (url.protocol === "wss:") url.protocol = "https:";
    else if (url.protocol === "ws:") url.protocol = "http:";
    else if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function twirpUrl(liveKitUrl: string, method: "CreateIngress" | "DeleteIngress" | "ListIngress"): string | null {
  const base = liveKitHttpBase(liveKitUrl);
  return base ? `${base}/twirp/livekit.Ingress/${method}` : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function ingressIdOf(info: LiveKitIngressInfo): string | null {
  return asString(info.ingress_id) ?? asString(info.ingressId);
}

function streamKeyOf(info: LiveKitIngressInfo): string | null {
  return asString(info.stream_key) ?? asString(info.streamKey);
}

function urlOf(info: LiveKitIngressInfo): string | null {
  return asString(info.url);
}

function boundIngressName(streamId: string): string {
  const raw = `picom-obs-${streamId.replace(/-/g, "").slice(0, 24)}`;
  return raw.slice(0, maxIngressNameLength);
}

function credentialPrefixFromSecret(secret: string): string {
  const cleaned = secret.replace(/[^a-zA-Z0-9]/g, "");
  if (cleaned.length >= 8) return cleaned.slice(0, 8).toLowerCase();
  return cleaned.slice(0, 8).toLowerCase().padEnd(8, "0").slice(0, 8);
}

function isServiceRoleBearer(authorization: string | null, serviceRoleKey: string): boolean {
  if (!authorization || !serviceRoleKey) return false;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  if (!match) return false;
  const token = match[1];
  if (token.length !== serviceRoleKey.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i += 1) diff |= token.charCodeAt(i) ^ serviceRoleKey.charCodeAt(i);
  return diff === 0;
}

function serviceClient(): SupabaseClient | null {
  const supabaseUrl = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function liveKitIngressRequest(
  method: "CreateIngress" | "DeleteIngress" | "ListIngress",
  body: Record<string, unknown>,
): Promise<{ ok: true; info: LiveKitIngressInfo | LiveKitIngressInfo[] | null } | { ok: false; response: Response }> {
  const liveKitUrl = env("LIVEKIT_URL");
  const apiKey = env("LIVEKIT_API_KEY");
  const apiSecret = env("LIVEKIT_API_SECRET");
  if (!liveKitUrl || !apiKey || !apiSecret) {
    return { ok: false, response: errorResponse("VOICE_NOT_CONFIGURED", "LiveKit Ingress is not configured.", 503) };
  }
  const endpoint = twirpUrl(liveKitUrl, method);
  if (!endpoint) {
    return { ok: false, response: errorResponse("VOICE_NOT_CONFIGURED", "LIVEKIT_URL is invalid.", 503) };
  }
  const { token } = await createLiveKitIngressAdminToken({ apiKey, apiSecret, ttlSeconds: 60 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        response: errorResponse("INTERNAL_ERROR", `LiveKit Ingress ${method} failed.`, response.status >= 500 ? 503 : 502),
      };
    }
    if (!text) return { ok: true, info: null };
    const parsed = JSON.parse(text) as unknown;
    if (method === "ListIngress") {
      const items = (parsed as { items?: unknown })?.items;
      return {
        ok: true,
        info: Array.isArray(items) ? (items as LiveKitIngressInfo[]) : [],
      };
    }
    return { ok: true, info: (parsed && typeof parsed === "object" ? parsed : null) as LiveKitIngressInfo | null };
  } catch {
    return { ok: false, response: errorResponse("INTERNAL_ERROR", "LiveKit Ingress is temporarily unavailable.", 503, undefined, { "Retry-After": "30" }) };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadOwnedStream(
  operator: SupabaseClient,
  streamId: string,
  ownerUserId: string | null,
): Promise<{ ok: true; stream: PublisherStreamRow } | { ok: false; response: Response }> {
  const { data, error } = await operator
    .from("publisher_streams")
    .select("id, owner_user_id, ingest_mode, room_name, status")
    .eq("id", streamId)
    .maybeSingle();
  if (error) return { ok: false, response: errorResponse("INTERNAL_ERROR", "Stream lookup failed.", 503) };
  if (!data) return { ok: false, response: errorResponse("VALIDATION_ERROR", "Stream was not found.", 404) };
  const stream = data as PublisherStreamRow;
  if (ownerUserId && stream.owner_user_id !== ownerUserId) {
    return { ok: false, response: errorResponse("AUTH_INVALID", "Only the stream owner can manage ingress.", 403) };
  }
  if (stream.ingest_mode !== "OBS_EXTERNAL") {
    return { ok: false, response: errorResponse("VALIDATION_ERROR", "Ingress is only available for OBS_EXTERNAL streams.", 400) };
  }
  if (ownerUserId) {
    // Service-role client has no auth.uid(); evaluate eligibility for the authenticated owner.
    const { data: canBroadcast, error: manageError } = await operator.rpc("user_can_broadcast_on_picom_live", {
      target_user_id: ownerUserId,
    });
    if (manageError) {
      return { ok: false, response: errorResponse("INTERNAL_ERROR", "Publisher eligibility check failed.", 503) };
    }
    if (canBroadcast !== true) {
      return {
        ok: false,
        response: errorResponse("AUTH_INVALID", "Publisher broadcast permission is required for OBS ingest.", 403),
      };
    }
  }
  return { ok: true, stream };
}

async function ensureRoomName(operator: SupabaseClient, stream: PublisherStreamRow): Promise<string> {
  const roomName = stream.room_name && matchesPicomPublisherStreamLiveKitRoomName(stream.room_name, stream.id)
    ? stream.room_name
    : createPicomPublisherStreamLiveKitRoomName(stream.id);
  if (stream.room_name !== roomName) {
    await operator.from("publisher_streams").update({ room_name: roomName, updated_at: new Date().toISOString() }).eq("id", stream.id);
  }
  return roomName;
}

async function bindLiveKitCredential(params: {
  operator: SupabaseClient;
  streamId: string;
  ownerUserId: string;
  ingressId: string;
  ingestUrl: string;
  streamKey: string;
  roomName: string;
}): Promise<{ ok: true; credentialId: string; prefix: string } | { ok: false; response: Response }> {
  const { data: hash, error: hashError } = await params.operator.rpc("publisher_stream_hash_secret", {
    raw_secret: params.streamKey,
  });
  if (hashError || typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) {
    return { ok: false, response: errorResponse("INTERNAL_ERROR", "Credential hashing failed.", 503) };
  }
  const prefix = credentialPrefixFromSecret(params.streamKey);
  const { data: existing, error: existingError } = await params.operator
    .from("publisher_stream_credentials")
    .select("id, stream_id, provider_ingress_id, ingest_url, status")
    .eq("stream_id", params.streamId)
    .eq("status", "active")
    .maybeSingle();
  if (existingError) return { ok: false, response: errorResponse("INTERNAL_ERROR", "Credential lookup failed.", 503) };

  if (existing) {
    const { error: rotateError } = await params.operator
      .from("publisher_stream_credentials")
      .update({
        status: "rotated",
        rotated_at: new Date().toISOString(),
        provider_ingress_id: null,
      })
      .eq("id", (existing as CredentialRow).id);
    if (rotateError) return { ok: false, response: errorResponse("INTERNAL_ERROR", "Credential rotate failed.", 503) };
  }

  const { data: inserted, error: insertError } = await params.operator
    .from("publisher_stream_credentials")
    .insert({
      stream_id: params.streamId,
      owner_user_id: params.ownerUserId,
      credential_prefix: prefix,
      secret_hash: hash,
      provider_ingress_id: params.ingressId,
      provider_room_name: params.roomName,
      ingest_url: params.ingestUrl,
      protocol: "RTMP",
      status: "active",
    })
    .select("id")
    .single();
  if (insertError || !inserted?.id) {
    return { ok: false, response: errorResponse("INTERNAL_ERROR", "Credential create failed.", 503) };
  }
  return { ok: true, credentialId: inserted.id as string, prefix };
}

async function provisionIngress(
  operator: SupabaseClient,
  stream: PublisherStreamRow,
  requestedRoomName: string | undefined,
): Promise<Response> {
  const roomName = requestedRoomName
    ? (matchesPicomPublisherStreamLiveKitRoomName(requestedRoomName, stream.id)
      ? requestedRoomName
      : null)
    : await ensureRoomName(operator, stream);
  if (!roomName) {
    return errorResponse("VALIDATION_ERROR", "roomName must match publisher-stream:{streamId}.", 400);
  }

  const { data: existingCred } = await operator
    .from("publisher_stream_credentials")
    .select("id, provider_ingress_id, ingest_url, status")
    .eq("stream_id", stream.id)
    .eq("status", "active")
    .maybeSingle();
  const existingIngressId = (existingCred as CredentialRow | null)?.provider_ingress_id ?? null;
  if (existingIngressId) {
    const deleted = await liveKitIngressRequest("DeleteIngress", { ingressId: existingIngressId });
    if (!deleted.ok) return deleted.response;
  }

  const created = await liveKitIngressRequest("CreateIngress", {
    inputType: rtmpInputType,
    name: boundIngressName(stream.id),
    roomName,
    participantIdentity: `obs:${stream.id}`,
    participantName: "OBS",
  });
  if (!created.ok) return created.response;
  const info = created.info as LiveKitIngressInfo | null;
  const ingressId = info ? ingressIdOf(info) : null;
  const ingestUrl = info ? urlOf(info) : null;
  const streamKey = info ? streamKeyOf(info) : null;
  if (!ingressId || !ingestUrl || !streamKey) {
    return errorResponse("INTERNAL_ERROR", "LiveKit Ingress returned an incomplete RTMP credential.", 502);
  }

  const bound = await bindLiveKitCredential({
    operator,
    streamId: stream.id,
    ownerUserId: stream.owner_user_id,
    ingressId,
    ingestUrl,
    streamKey,
    roomName,
  });
  if (!bound.ok) {
    const cleanup = await liveKitIngressRequest("DeleteIngress", { ingressId });
    if (!cleanup.ok) {
      // Do not log streamKey. Surface orphan ingress id only in the client error details.
      return errorResponse(
        "INTERNAL_ERROR",
        "Credential bind failed and ingress cleanup requires retry.",
        503,
        { ingressId, cleanupRequired: true },
        { "Retry-After": "30" },
      );
    }
    return bound.response;
  }

  await operator
    .from("publisher_streams")
    .update({
      room_name: roomName,
      connection_state: "WAITING",
      updated_at: new Date().toISOString(),
    })
    .eq("id", stream.id);

  // Plaintext LiveKit stream key is returned once to the authenticated owner. Never log it.
  return jsonResponse({
    action: "create",
    streamId: stream.id,
    ingressId,
    url: ingestUrl,
    streamKey,
    roomName,
    credentialId: bound.credentialId,
    prefix: bound.prefix,
    revealedOnce: true,
  });
}

async function deleteIngress(operator: SupabaseClient, stream: PublisherStreamRow): Promise<Response> {
  const { data: cred } = await operator
    .from("publisher_stream_credentials")
    .select("id, provider_ingress_id, ingest_url, status")
    .eq("stream_id", stream.id)
    .eq("status", "active")
    .maybeSingle();
  const ingressId = (cred as CredentialRow | null)?.provider_ingress_id ?? null;
  if (ingressId) {
    const deleted = await liveKitIngressRequest("DeleteIngress", { ingressId });
    if (!deleted.ok) return deleted.response;
  }
  if (cred) {
    await operator
      .from("publisher_stream_credentials")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        provider_ingress_id: null,
        ingest_url: null,
      })
      .eq("id", (cred as CredentialRow).id);
  }
  await operator
    .from("publisher_streams")
    .update({
      connection_state: "REVOKED",
      health_status: "DISCONNECTED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", stream.id);
  return jsonResponse({ action: "delete", streamId: stream.id, deleted: Boolean(ingressId), ingressId });
}

async function getIngress(operator: SupabaseClient, stream: PublisherStreamRow): Promise<Response> {
  const roomName = stream.room_name ?? createPicomPublisherStreamLiveKitRoomName(stream.id);
  const { data: cred } = await operator
    .from("publisher_stream_credentials")
    .select("id, provider_ingress_id, ingest_url, status")
    .eq("stream_id", stream.id)
    .eq("status", "active")
    .maybeSingle();
  const credential = cred as CredentialRow | null;
  let remote: LiveKitIngressInfo | null = null;
  if (credential?.provider_ingress_id) {
    const listed = await liveKitIngressRequest("ListIngress", { ingressId: credential.provider_ingress_id });
    if (!listed.ok) return listed.response;
    const items = Array.isArray(listed.info) ? listed.info : [];
    remote = items.find((item) => ingressIdOf(item) === credential.provider_ingress_id) ?? null;
  } else {
    const listed = await liveKitIngressRequest("ListIngress", { roomName });
    if (!listed.ok) return listed.response;
    const items = Array.isArray(listed.info) ? listed.info : [];
    remote = items[0] ?? null;
  }

  return jsonResponse({
    action: "get",
    streamId: stream.id,
    roomName,
    ingressId: credential?.provider_ingress_id ?? (remote ? ingressIdOf(remote) : null),
    url: credential?.ingest_url ?? (remote ? urlOf(remote) : null),
    // Never re-emit streamKey after the one-time create response.
    hasActiveCredential: Boolean(credential),
    remotePresent: Boolean(remote),
  });
}

Deno.serve(async (request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const operator = serviceClient();
  if (!operator || !serviceRoleKey) {
    return errorResponse("SUPABASE_NOT_CONFIGURED", "Supabase service credentials are not configured.", 503);
  }

  const serviceAuth = isServiceRoleBearer(request.headers.get("Authorization"), serviceRoleKey);
  let ownerUserId: string | null = null;
  if (!serviceAuth) {
    const auth = await requireSupabaseUser(request);
    if (!auth.ok) return auth.response;
    ownerUserId = auth.user.id;
  }

  const parsed = await readBoundedJsonObject<IngressRequestBody>(request, { maxBytes: maxBodyBytes, allowedKeys });
  if (!parsed.ok) return parsed.response;
  const action = parsed.body.action;
  const streamId = parsed.body.streamId;
  if (!action || !["create", "delete", "get", "provisionForStream"].includes(action)) {
    return errorResponse("VALIDATION_ERROR", "action must be create, delete, get, or provisionForStream.", 400);
  }
  if (!streamId || !uuidPattern.test(streamId)) {
    return errorResponse("VALIDATION_ERROR", "A valid streamId is required.", 400);
  }
  if (parsed.body.roomName !== undefined && (typeof parsed.body.roomName !== "string" || parsed.body.roomName.length > 120)) {
    return errorResponse("VALIDATION_ERROR", "roomName is invalid.", 400);
  }

  const loaded = await loadOwnedStream(operator, streamId, ownerUserId);
  if (!loaded.ok) return loaded.response;

  if ((action === "create" || action === "provisionForStream") && !serviceAuth) {
    const rateUserId = ownerUserId ?? loaded.stream.owner_user_id;
    const { data: allowed, error: rateError } = await operator.rpc("consume_publisher_stream_rate_limit", {
      target_user_id: rateUserId,
      target_action: "credential_create",
      max_attempts: 10,
      window_seconds: 3600,
    });
    if (rateError) return errorResponse("INTERNAL_ERROR", "Rate limit check failed.", 503);
    if (allowed !== true) {
      return errorResponse("RATE_LIMITED", "Too many ingress provision requests. Try again later.", 429, undefined, { "Retry-After": "3600" });
    }
  }

  if (action === "create" || action === "provisionForStream") {
    return await provisionIngress(operator, loaded.stream, parsed.body.roomName);
  }
  if (action === "delete") return await deleteIngress(operator, loaded.stream);
  return await getIngress(operator, loaded.stream);
});
