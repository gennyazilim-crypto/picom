import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

type ResolveBody = {
  action?: "resolve" | "impression" | "click" | "explanation";
  placement?: string;
  context?: Record<string, unknown>;
  requestId?: string;
  anonymousSessionId?: string;
  decisionId?: string;
  deliveryToken?: string;
  visibilityRatio?: number;
  visibleDurationMs?: number;
  clientEventId?: string;
  idempotencyKey?: string;
};

function requireSigningSecret(): string | null {
  return Deno.env.get("AD_DELIVERY_SIGNING_SECRET") ?? null;
}

async function signToken(secret: string, claims: Record<string, string | number | boolean>): Promise<string> {
  const payload = btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${payload}.${sig}`;
}

async function verifyToken(secret: string, token: string): Promise<Record<string, unknown>> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) throw new Error("DELIVERY_TOKEN_INVALID");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const normalized = sig.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const sigBytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
  if (!ok) throw new Error("DELIVERY_TOKEN_SIGNATURE_INVALID");
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  const claims = JSON.parse(json) as Record<string, unknown>;
  const expiresAt = typeof claims.expires_at === "number" ? claims.expires_at : 0;
  if (expiresAt < Math.floor(Date.now() / 1000)) throw new Error("DELIVERY_TOKEN_EXPIRED");
  return claims;
}

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const body = await readBoundedJsonObject<ResolveBody>(request, {
    maxBytes: 8192,
    allowedKeys: new Set([
      "action",
      "placement",
      "context",
      "requestId",
      "anonymousSessionId",
      "decisionId",
      "deliveryToken",
      "visibilityRatio",
      "visibleDurationMs",
      "clientEventId",
      "idempotencyKey",
    ]),
  });
  if (!body.ok) return body.response;

  const secret = requireSigningSecret();
  if (!secret) {
    return errorResponse("AD_DELIVERY_SIGNING_SECRET_MISSING", "Ad delivery signing is not configured.", 503);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return errorResponse("SUPABASE_NOT_CONFIGURED", "Supabase is not configured.", 503);

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });

  const action = body.body.action ?? "resolve";

  if (action === "resolve") {
    if (!body.body.placement) return errorResponse("VALIDATION", "placement is required.", 400);
    const { data, error } = await userClient.rpc("resolve_ad_delivery", {
      target_user_id: auth.user.id,
      anonymous_session_id: body.body.anonymousSessionId ?? null,
      target_placement: body.body.placement,
      target_context: body.body.context ?? {},
      target_request_id: body.body.requestId ?? null,
    });
    if (error) return errorResponse("DELIVERY_RESOLVE_FAILED", "Delivery could not be resolved.", 400);
    const row = (data ?? {}) as Record<string, unknown>;
    if (row.eligible === true && typeof row.decision_id === "string") {
      const ttl = Number(Deno.env.get("AD_DELIVERY_TOKEN_TTL_SECONDS") ?? "300");
      const issuedAt = Math.floor(Date.now() / 1000);
      const token = await signToken(secret, {
        decision_id: row.decision_id,
        placement: body.body.placement,
        issued_at: issuedAt,
        expires_at: issuedAt + ttl,
        nonce: typeof row.token_nonce === "string" ? row.token_nonce : crypto.randomUUID(),
      });
      return jsonResponse({ ...row, deliveryToken: token });
    }
    return jsonResponse(row);
  }

  if (action === "impression") {
    if (!body.body.deliveryToken || !body.body.clientEventId) {
      return errorResponse("VALIDATION", "deliveryToken and clientEventId are required.", 400);
    }
    let claims: Record<string, unknown>;
    try {
      claims = await verifyToken(secret, body.body.deliveryToken);
    } catch (error) {
      return errorResponse("DELIVERY_TOKEN_INVALID", error instanceof Error ? error.message : "Invalid token", 401);
    }
    if (typeof claims.placement === "string" && body.body.placement && claims.placement !== body.body.placement) {
      return errorResponse("PLACEMENT_MISMATCH", "Token placement does not match.", 400);
    }
    const decisionId = typeof claims.decision_id === "string" ? claims.decision_id : body.body.decisionId;
    if (!decisionId) return errorResponse("VALIDATION", "decision_id missing.", 400);
    const { data, error } = await userClient.rpc("record_ad_impression", {
      target_decision_id: decisionId,
      target_visibility_ratio: body.body.visibilityRatio ?? 0,
      target_visible_duration_ms: body.body.visibleDurationMs ?? 0,
      target_client_event_id: body.body.clientEventId,
      target_user_id: auth.user.id,
      target_session_id: body.body.anonymousSessionId ?? null,
    });
    if (error) return errorResponse("IMPRESSION_FAILED", "Impression could not be recorded.", 400);
    return jsonResponse(data);
  }

  if (action === "click") {
    if (!body.body.deliveryToken || !body.body.idempotencyKey) {
      return errorResponse("VALIDATION", "deliveryToken and idempotencyKey are required.", 400);
    }
    let claims: Record<string, unknown>;
    try {
      claims = await verifyToken(secret, body.body.deliveryToken);
    } catch (error) {
      return errorResponse("DELIVERY_TOKEN_INVALID", error instanceof Error ? error.message : "Invalid token", 401);
    }
    const decisionId = typeof claims.decision_id === "string" ? claims.decision_id : body.body.decisionId;
    if (!decisionId) return errorResponse("VALIDATION", "decision_id missing.", 400);
    const { data, error } = await userClient.rpc("record_ad_click", {
      target_decision_id: decisionId,
      target_idempotency_key: body.body.idempotencyKey,
      target_user_id: auth.user.id,
    });
    if (error) return errorResponse("CLICK_FAILED", "Click could not be recorded.", 400);
    const row = (data ?? {}) as Record<string, unknown>;
    // Destination comes only from server snapshot RPC — never from client body.
    return jsonResponse({
      clickId: row.click_id,
      destinationUrl: row.destination_url,
      destinationDomain: row.destination_domain,
      duplicate: row.duplicate === true,
    });
  }

  if (action === "explanation") {
    if (!body.body.decisionId) return errorResponse("VALIDATION", "decisionId is required.", 400);
    const { data, error } = await userClient.rpc("get_ad_decision_explanation", {
      target_decision_id: body.body.decisionId,
    });
    if (error) return errorResponse("EXPLANATION_FAILED", "Explanation unavailable.", 400);
    return jsonResponse(data);
  }

  return errorResponse("VALIDATION", "Unknown action.", 400);
});
