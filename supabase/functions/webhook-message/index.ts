import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";

Deno.serve(async (request: Request) => {
  const preflight = handleCorsPreflight(request); if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);
  const url = new URL(request.url); const id = url.searchParams.get("id") ?? ""; const token = url.searchParams.get("token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{64}$/i.test(token)) return errorResponse("WEBHOOK_INVALID", "Invalid webhook credentials.", 401);
  let body: unknown; try { body = await request.json(); } catch { return errorResponse("VALIDATION_ERROR", "A JSON body is required.", 400); }
  const content = typeof body === "object" && body !== null && "content" in body ? String((body as { content?: unknown }).content ?? "").trim() : "";
  if (!content || content.length > 2000) return errorResponse("VALIDATION_ERROR", "Webhook content must contain 1 to 2000 characters.", 400);
  return jsonResponse({ code: "WEBHOOK_DELIVERY_DISABLED", message: "Webhook delivery remains disabled until token lookup, channel visibility checks, and rate limiting are production-ready." }, { status: 503, headers: { "Retry-After": "3600" } });
});
