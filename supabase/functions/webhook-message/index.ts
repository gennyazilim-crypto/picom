import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";

const encoder = new TextEncoder();
const maxRequestBytes = 16 * 1024;
const allowedPayloadKeys = new Set(["content"]);

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

function deliveryEnabled(): boolean {
  return Deno.env.get("PICOM_WEBHOOK_DELIVERY_ENABLED")?.trim().toLowerCase() === "true";
}

function getPresentedToken(request: Request): string {
  return request.headers.get("x-picom-webhook-token")?.trim() || "";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mapDeliveryError(error: unknown): Response {
  const message = typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  if (message.includes("WEBHOOK_RATE_LIMITED")) return errorResponse("WEBHOOK_RATE_LIMITED", "Webhook rate limit exceeded. Try again later.", 429, undefined, { "Retry-After": "60" });
  if (message.includes("WEBHOOK_VALIDATION_ERROR") || message.includes("WEBHOOK_IDEMPOTENCY_INVALID")) return errorResponse("VALIDATION_ERROR", "Webhook request validation failed.", 400);
  if (message.includes("WEBHOOK_INVALID") || message.includes("WEBHOOK_CHANNEL_FORBIDDEN")) return errorResponse("WEBHOOK_INVALID", "Invalid or unavailable webhook.", 401);
  return errorResponse("INTERNAL_ERROR", "Webhook delivery is temporarily unavailable.", 503, undefined, { "Retry-After": "60" });
}

async function readValidatedPayload(request: Request): Promise<{ ok: true; content: string } | { ok: false; response: Response }> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    return { ok: false, response: errorResponse("VALIDATION_ERROR", "Webhook requests must use application/json.", 415) };
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
    return { ok: false, response: errorResponse("VALIDATION_ERROR", "Webhook payload is too large.", 413) };
  }

  const rawBody = await request.text();
  if (encoder.encode(rawBody).byteLength > maxRequestBytes) {
    return { ok: false, response: errorResponse("VALIDATION_ERROR", "Webhook payload is too large.", 413) };
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, response: errorResponse("VALIDATION_ERROR", "A valid JSON body is required.", 400) };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, response: errorResponse("VALIDATION_ERROR", "Webhook payload must be a JSON object.", 400) };
  }
  const keys = Object.keys(body);
  if (keys.some((key) => !allowedPayloadKeys.has(key))) {
    return { ok: false, response: errorResponse("VALIDATION_ERROR", "Webhook payload contains unsupported fields.", 400) };
  }
  const contentValue = (body as { content?: unknown }).content;
  if (typeof contentValue !== "string") {
    return { ok: false, response: errorResponse("VALIDATION_ERROR", "Webhook content must be text.", 400) };
  }
  const content = contentValue.trim();
  if (!content || content.length > 2000) {
    return { ok: false, response: errorResponse("VALIDATION_ERROR", "Webhook content must contain 1 to 2000 characters.", 400) };
  }
  return { ok: true, content };
}

Deno.serve(async (request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);
  if (!deliveryEnabled()) return errorResponse("WEBHOOK_DELIVERY_DISABLED", "Webhook delivery is temporarily disabled.", 503, undefined, { "Retry-After": "3600" });

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return errorResponse("INTERNAL_ERROR", "Webhook delivery is not configured.", 503);

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim() ?? "";
  const token = getPresentedToken(request);
  const requestKey = request.headers.get("idempotency-key")?.trim() || null;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{64}$/i.test(token)) return errorResponse("WEBHOOK_INVALID", "Invalid or unavailable webhook.", 401);
  if (requestKey && !/^[A-Za-z0-9._:-]{8,80}$/.test(requestKey)) return errorResponse("VALIDATION_ERROR", "Idempotency-Key must contain 8 to 80 safe characters.", 400);

  const payload = await readValidatedPayload(request);
  if (!payload.ok) return payload.response;

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.rpc("deliver_webhook_message", {
    target_webhook_id: id,
    presented_token_hash: await sha256Hex(token),
    message_body: payload.content,
    request_key: requestKey,
  });
  if (error || !Array.isArray(data) || !data[0]) return mapDeliveryError(error);

  return jsonResponse({
    messageId: data[0].message_id,
    channelId: data[0].target_channel_id,
    delivered: true,
  }, { status: 201 });
});
