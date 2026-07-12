import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";

type CallbackBody = { captionSessionId?: string; status?: "active" | "failed" | "stopped"; errorCode?: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
function env(name: string): string | null { const value = Deno.env.get(name)?.trim(); return value || null; }
async function secureEqual(left: string, right: string): Promise<boolean> { const encode = (value: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); const [a, b] = await Promise.all([encode(left), encode(right)]); const aa = new Uint8Array(a), bb = new Uint8Array(b); let difference = 0; for (let index = 0; index < aa.length; index += 1) difference |= aa[index] ^ bb[index]; return difference === 0; }

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  const expected = env("PICOM_CAPTIONS_AGENT_CALLBACK_SECRET"), supplied = request.headers.get("X-Picom-Captions-Callback-Secret") ?? "";
  if (!expected || !supplied || !(await secureEqual(expected, supplied))) return errorResponse("VALIDATION_ERROR", "Caption agent callback authentication failed.", 401);
  const text = await request.text(); if (!text || new TextEncoder().encode(text).byteLength > 1024) return errorResponse("VALIDATION_ERROR", "Invalid callback body.", 400);
  let body: CallbackBody; try { const value = JSON.parse(text) as unknown; if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !["captionSessionId", "status", "errorCode"].includes(key))) throw new Error(); body = value as CallbackBody; } catch { return errorResponse("VALIDATION_ERROR", "Invalid callback body.", 400); }
  if (!body.captionSessionId || !uuidPattern.test(body.captionSessionId) || !body.status || !["active", "failed", "stopped"].includes(body.status) || (body.errorCode && !/^[A-Z0-9_]{1,80}$/.test(body.errorCode))) return errorResponse("VALIDATION_ERROR", "Invalid caption lifecycle callback.", 400);
  const url = env("SUPABASE_URL"), key = env("SUPABASE_SERVICE_ROLE_KEY"); if (!url || !key) return errorResponse("INTERNAL_ERROR", "Caption lifecycle service is unavailable.", 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); const now = new Date().toISOString();
  const sessionPatch = body.status === "active" ? { status: "active", started_at: now, error_code: null, updated_at: now } : body.status === "failed" ? { status: "failed", stopped_at: now, error_code: body.errorCode ?? "CAPTION_AGENT_FAILED", updated_at: now } : { status: "stopped", stopped_at: now, error_code: null, updated_at: now };
  const session = await admin.from("meeting_caption_sessions").update(sessionPatch).eq("id", body.captionSessionId).select("id").maybeSingle();
  if (session.error || !session.data) return errorResponse("INTERNAL_ERROR", "Caption lifecycle state could not be updated.", 503);
  await admin.from("meeting_caption_dispatches").update({ provider_state: body.status === "active" ? "running" : body.status, last_error_code: body.status === "failed" ? body.errorCode ?? "CAPTION_AGENT_FAILED" : null, updated_at: now }).eq("caption_session_id", body.captionSessionId);
  return jsonResponse({ ok: true, status: body.status });
});
