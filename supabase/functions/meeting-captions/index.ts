import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { createLiveKitRoomAdminToken } from "../_shared/livekit-token.ts";

type CaptionAction = "status" | "request" | "consent" | "stop";
type CaptionRequest = { action?: CaptionAction; roomId?: string; sessionId?: string; language?: string; decision?: "accepted" | "declined"; policyVersion?: string };
type DispatchPreparation = { shouldDispatch?: boolean; captionSessionId?: string; roomName?: string; language?: string; policyVersion?: string; retentionMode?: string; status?: string; pendingConsentCount?: number };
type CaptionState = Record<string, unknown> & { id?: string; status?: string; mustStop?: boolean };

const POLICY_VERSION = "2026-07-11";
const AGENT_NAME = "picom-captions";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const languages = new Set(["en", "tr", "de", "es", "fr"]);
const allowedKeys = new Set(["action", "roomId", "sessionId", "language", "decision", "policyVersion"]);

function env(name: string): string | null { const value = Deno.env.get(name)?.trim(); return value || null; }
function providerConfigured(): boolean { return env("PICOM_CAPTIONS_ENABLED") === "true" && env("PICOM_CAPTIONS_PROVIDER") === "deepgram_livekit_agent" && Boolean(env("LIVEKIT_URL") && env("LIVEKIT_API_KEY") && env("LIVEKIT_API_SECRET") && env("SUPABASE_SERVICE_ROLE_KEY")); }
function adminClient(): SupabaseClient | null { const url = env("SUPABASE_URL"), key = env("SUPABASE_SERVICE_ROLE_KEY"); return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null; }
function liveKitHttpUrl(value: string): string { const url = new URL(value); if (url.protocol === "wss:") url.protocol = "https:"; else if (url.protocol === "ws:") url.protocol = "http:"; return url.toString().replace(/\/$/, ""); }
function allowedOrigins(): Set<string> { return new Set((env("PICOM_ALLOWED_ORIGINS") ?? "http://127.0.0.1:5173,http://localhost:5173").split(",").map((item) => item.trim()).filter(Boolean)); }
function corsHeadersFor(request: Request): HeadersInit | null { const origin = request.headers.get("Origin"); if (origin && !allowedOrigins().has(origin)) return null; return { ...(origin ? { "Access-Control-Allow-Origin": origin } : {}), "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-picom-api-version, x-picom-client-version", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "600", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", Vary: "Origin" }; }
function withCors(response: Response, headers: HeadersInit): Response { const next = new Headers(response.headers); next.delete("Access-Control-Allow-Origin"); for (const [key, value] of new Headers(headers)) next.set(key, value); return new Response(response.body, { status: response.status, statusText: response.statusText, headers: next }); }
async function readBody(request: Request): Promise<CaptionRequest | null> { if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) return null; const text = await request.text(); if (!text || new TextEncoder().encode(text).byteLength > 2048) return null; try { const parsed = JSON.parse(text) as unknown; if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some((key) => !allowedKeys.has(key))) return null; return parsed as CaptionRequest; } catch { return null; } }
function captionResponse(state: unknown): Record<string, unknown> { return { ...(state && typeof state === "object" && !Array.isArray(state) ? state as Record<string, unknown> : {}), configured: providerConfigured(), provider: "deepgram_livekit_agent", model: "nova-3", retentionMode: "ephemeral", policyVersion: POLICY_VERSION }; }

async function providerRequest(path: "CreateDispatch" | "DeleteDispatch", body: Record<string, unknown>): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false }> {
  const url = env("LIVEKIT_URL"), apiKey = env("LIVEKIT_API_KEY"), apiSecret = env("LIVEKIT_API_SECRET");
  if (!url || !apiKey || !apiSecret) return { ok: false };
  const { token } = await createLiveKitRoomAdminToken({ apiKey, apiSecret, roomName: String(body.room ?? ""), ttlSeconds: 60 });
  try { const response = await fetch(`${liveKitHttpUrl(url)}/twirp/livekit.AgentDispatchService/${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }); if (!response.ok) return { ok: false }; const data = await response.json() as unknown; return data && typeof data === "object" && !Array.isArray(data) ? { ok: true, data: data as Record<string, unknown> } : { ok: false }; } catch { return { ok: false }; }
}

async function prepareDispatch(admin: SupabaseClient, roomId: string, sessionId: string): Promise<boolean> {
  const result = await admin.rpc("prepare_meeting_caption_dispatch", { target_room_id: roomId, target_session_id: sessionId });
  const prepared = result.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data as DispatchPreparation : null;
  if (result.error || !prepared) return false;
  if (!prepared.shouldDispatch) return true;
  if (!prepared.captionSessionId || !prepared.roomName || !languages.has(prepared.language ?? "") || prepared.retentionMode !== "ephemeral") return false;
  const metadata = JSON.stringify({ captionSessionId: prepared.captionSessionId, roomId, sessionId, language: prepared.language, policyVersion: prepared.policyVersion, retentionMode: "ephemeral" });
  const dispatched = await providerRequest("CreateDispatch", { agent_name: env("PICOM_CAPTIONS_AGENT_NAME") ?? AGENT_NAME, room: prepared.roomName, metadata });
  const dispatchId = dispatched.ok ? String(dispatched.data.id ?? dispatched.data.dispatch_id ?? "") : "";
  if (!dispatchId) { await admin.from("meeting_caption_sessions").update({ status: "failed", error_code: "CAPTION_PROVIDER_UNAVAILABLE", updated_at: new Date().toISOString() }).eq("id", prepared.captionSessionId); return false; }
  const persisted = await admin.from("meeting_caption_dispatches").upsert({ caption_session_id: prepared.captionSessionId, dispatch_id: dispatchId, provider_state: "created", last_error_code: null, updated_at: new Date().toISOString() });
  if (persisted.error) { await providerRequest("DeleteDispatch", { dispatch_id: dispatchId, room: prepared.roomName }); await admin.from("meeting_caption_sessions").update({ status: "failed", error_code: "CAPTION_DISPATCH_STATE_FAILED", updated_at: new Date().toISOString() }).eq("id", prepared.captionSessionId); return false; }
  return true;
}

async function stopDispatch(admin: SupabaseClient, captionSessionId: string): Promise<boolean> {
  const [dispatchResult, sessionResult] = await Promise.all([admin.from("meeting_caption_dispatches").select("dispatch_id").eq("caption_session_id", captionSessionId).maybeSingle(), admin.from("meeting_caption_sessions").select("session_id").eq("id", captionSessionId).maybeSingle()]);
  if (dispatchResult.error || sessionResult.error) return false;
  let stopped = true;
  if (dispatchResult.data?.dispatch_id) { const sessionId = String(sessionResult.data?.session_id ?? ""); const roomResult = await admin.from("meeting_sessions").select("provider_room_name").eq("id", sessionId).maybeSingle(); const roomName = String(roomResult.data?.provider_room_name ?? ""); stopped = Boolean(roomName) && (await providerRequest("DeleteDispatch", { dispatch_id: dispatchResult.data.dispatch_id, room: roomName })).ok; }
  if (!stopped) return false;
  const now = new Date().toISOString();
  await admin.from("meeting_caption_dispatches").update({ provider_state: "stopped", updated_at: now }).eq("caption_session_id", captionSessionId);
  const updated = await admin.from("meeting_caption_sessions").update({ status: "stopped", stopped_at: now, updated_at: now }).eq("id", captionSessionId);
  return !updated.error;
}

Deno.serve(async (request: Request) => {
  const cors = corsHeadersFor(request);
  if (!cors) return new Response(JSON.stringify({ code: "VALIDATION_ERROR", message: "Origin is not allowed." }), { status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const respond = (response: Response) => withCors(response, cors);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return respond(methodNotAllowed(["POST", "OPTIONS"]));
  const body = await readBody(request);
  const action = body?.action ?? "status";
  if (!body?.roomId || !body.sessionId || !uuidPattern.test(body.roomId) || !uuidPattern.test(body.sessionId) || !["status", "request", "consent", "stop"].includes(action)) return respond(errorResponse("VALIDATION_ERROR", "Valid roomId, sessionId, and action are required.", 400));
  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return respond(auth.response);
  const admin = adminClient();
  if (!admin) return respond(errorResponse("INTERNAL_ERROR", "Caption lifecycle service is not configured.", 503));

  if (action === "status") { const state = await auth.supabase.rpc("get_meeting_caption_state", { target_room_id: body.roomId, target_session_id: body.sessionId }); if (state.error) return respond(errorResponse("INTERNAL_ERROR", "Caption status is unavailable.", 503)); return respond(jsonResponse(captionResponse(state.data))); }
  if (!providerConfigured()) return respond(errorResponse("INTERNAL_ERROR", "Live captions are temporarily unavailable.", 503));
  if (body.policyVersion !== POLICY_VERSION) return respond(errorResponse("VALIDATION_ERROR", "The current caption consent policy must be accepted.", 400));

  if (action === "request") {
    if (!body.language || !languages.has(body.language)) return respond(errorResponse("VALIDATION_ERROR", "Choose a supported caption language.", 400));
    const state = await auth.supabase.rpc("request_meeting_captions", { target_room_id: body.roomId, target_session_id: body.sessionId, target_language: body.language, target_policy_version: POLICY_VERSION });
    if (state.error) return respond(errorResponse("VALIDATION_ERROR", "You cannot start captions for this meeting.", 403));
    const dispatched = await prepareDispatch(admin, body.roomId, body.sessionId);
    if (!dispatched) return respond(errorResponse("INTERNAL_ERROR", "The caption provider could not be started.", 503));
    const refreshed = await auth.supabase.rpc("get_meeting_caption_state", { target_room_id: body.roomId, target_session_id: body.sessionId });
    return respond(jsonResponse(captionResponse(refreshed.data ?? state.data)));
  }

  if (action === "consent") {
    if (!body.decision || !["accepted", "declined"].includes(body.decision)) return respond(errorResponse("VALIDATION_ERROR", "Choose whether to allow live transcription of your meeting audio.", 400));
    const state = await auth.supabase.rpc("record_meeting_caption_consent", { target_room_id: body.roomId, target_session_id: body.sessionId, target_decision: body.decision, target_policy_version: POLICY_VERSION });
    const value = state.data && typeof state.data === "object" && !Array.isArray(state.data) ? state.data as CaptionState : null;
    if (state.error || !value) return respond(errorResponse("VALIDATION_ERROR", "Caption consent could not be recorded.", 403));
    const lifecycleOk = value.mustStop && value.id ? await stopDispatch(admin, value.id) : body.decision === "accepted" ? await prepareDispatch(admin, body.roomId, body.sessionId) : true;
    if (!lifecycleOk) return respond(errorResponse("INTERNAL_ERROR", "The caption provider did not accept the lifecycle change.", 503));
    const refreshed = await auth.supabase.rpc("get_meeting_caption_state", { target_room_id: body.roomId, target_session_id: body.sessionId });
    return respond(jsonResponse(captionResponse(refreshed.data ?? value)));
  }

  const stopped = await auth.supabase.rpc("request_stop_meeting_captions", { target_room_id: body.roomId, target_session_id: body.sessionId });
  const stoppedValue = stopped.data && typeof stopped.data === "object" && !Array.isArray(stopped.data) ? stopped.data as { captionSessionId?: string } : null;
  if (stopped.error || !stoppedValue?.captionSessionId) return respond(errorResponse("VALIDATION_ERROR", "You cannot stop captions for this meeting.", 403));
  if (!(await stopDispatch(admin, stoppedValue.captionSessionId))) return respond(errorResponse("INTERNAL_ERROR", "Captions are stopping, but the provider has not confirmed shutdown.", 503));
  const refreshed = await auth.supabase.rpc("get_meeting_caption_state", { target_room_id: body.roomId, target_session_id: body.sessionId });
  return respond(jsonResponse(captionResponse(refreshed.data)));
});
