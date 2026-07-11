import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";

type MeetingJoinAction = "preview" | "validate" | "redeem";
type MeetingJoinRequest = { action?: MeetingJoinAction; roomId?: string; inviteToken?: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const invitePattern = /^[0-9a-f]{64}$/i;
const allowedKeys = new Set(["action", "roomId", "inviteToken"]);
const maxBodyBytes = 1024;

function configuredOrigins(): Set<string> {
  const value = Deno.env.get("PICOM_ALLOWED_ORIGINS") ?? "http://127.0.0.1:5173,http://localhost:5173";
  return new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
}

function corsHeadersFor(request: Request): HeadersInit | null {
  const origin = request.headers.get("Origin");
  if (origin && !configuredOrigins().has(origin)) return null;
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

async function readBody(request: Request): Promise<MeetingJoinRequest | null> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) return null;
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > maxBodyBytes) return null;
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !allowedKeys.has(key))) return null;
    return value as MeetingJoinRequest;
  } catch {
    return null;
  }
}

async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret.toLowerCase()));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  const cors = corsHeadersFor(request);
  if (!cors) return new Response(JSON.stringify({ code: "VALIDATION_ERROR", message: "Origin is not allowed." }), { status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const respond = (response: Response) => withCors(response, cors);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return respond(methodNotAllowed(["POST", "OPTIONS"]));
  const body = await readBody(request);
  if (!body) return respond(errorResponse("VALIDATION_ERROR", "A supported JSON request is required.", 400));
  const action = body.action ?? "preview";
  if (!body.roomId || !uuidPattern.test(body.roomId) || !["preview", "validate", "redeem"].includes(action)) return respond(errorResponse("VALIDATION_ERROR", "A valid roomId and action are required.", 400));
  if (body.inviteToken !== undefined && !invitePattern.test(body.inviteToken)) return respond(errorResponse("VALIDATION_ERROR", "The meeting invitation is invalid.", 400));
  if ((action === "validate" || action === "redeem") && !body.inviteToken) return respond(errorResponse("VALIDATION_ERROR", "An invitation is required for this action.", 400));
  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return respond(auth.response);
  const tokenHash = body.inviteToken ? await hashSecret(body.inviteToken) : null;
  const operation = action === "preview"
    ? auth.supabase.rpc("get_meeting_join_preview", { target_room_id: body.roomId, target_token_hash: tokenHash })
    : auth.supabase.rpc("validate_meeting_invite", { target_token_hash: tokenHash!, target_room_id: body.roomId, consume_use: action === "redeem" });
  const { data, error } = await operation;
  if (error) {
    const limited = error.message?.includes("RATE_LIMITED");
    return respond(errorResponse(limited ? "RATE_LIMITED" : "INTERNAL_ERROR", limited ? "Too many meeting requests. Please wait and try again." : "Meeting access is temporarily unavailable.", limited ? 429 : 503, undefined, limited ? { "Retry-After": "60" } : undefined));
  }
  return respond(jsonResponse(data));
});
