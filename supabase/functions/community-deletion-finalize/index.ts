import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

async function matchesWorkerSecret(expected: string, supplied: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let different = a.length ^ b.length;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) different |= a[index] ^ b[index];
  return different === 0;
}

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);
  if (requiredEnv("COMMUNITY_DELETION_FINALIZATION_ENABLED") !== "true") {
    return errorResponse("FORBIDDEN", "Community finalization is disabled pending operations approval.", 503);
  }
  const expectedSecret = requiredEnv("COMMUNITY_DELETION_WORKER_SECRET");
  const suppliedSecret = request.headers.get("x-picom-worker-secret") ?? "";
  if (!expectedSecret || !suppliedSecret || !(await matchesWorkerSecret(expectedSecret, suppliedSecret))) {
    return errorResponse("FORBIDDEN", "Worker authorization failed.", 403);
  }
  const parsed = await readBoundedJsonObject<{ batchLimit?: unknown }>(request, { maxBytes: 256, allowedKeys: new Set(["batchLimit"]) });
  if (!parsed.ok) return parsed.response;
  const batchLimit = typeof parsed.body.batchLimit === "number" && Number.isInteger(parsed.body.batchLimit)
    ? Math.max(1, Math.min(parsed.body.batchLimit, 100))
    : 25;
  const url = requiredEnv("SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return errorResponse("INTERNAL_ERROR", "Finalization dependencies are unavailable.", 503);
  const operator = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await operator.rpc("finalize_due_community_deletions", { batch_limit: batchLimit });
  if (error) return errorResponse("INTERNAL_ERROR", "Due community deletions could not be finalized safely.", 409);
  return jsonResponse({ finalized: Array.isArray(data) ? data.length : 0 }, { headers: { "Cache-Control": "no-store" } });
});
