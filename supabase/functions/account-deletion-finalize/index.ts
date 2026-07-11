import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function safeEqual(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  if (a.length !== b.length) return false;
  let different = 0;
  for (let index = 0; index < a.length; index += 1) different |= a[index] ^ b[index];
  return different === 0;
}

Deno.serve(async (request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);
  if (requiredEnv("ACCOUNT_DELETION_FINALIZATION_ENABLED") !== "true") return errorResponse("FORBIDDEN", "Account finalization is disabled pending legal and operations approval.", 503);
  const expectedSecret = requiredEnv("ACCOUNT_DELETION_WORKER_SECRET");
  const suppliedSecret = request.headers.get("x-picom-worker-secret") ?? "";
  if (!expectedSecret || !suppliedSecret || !(await safeEqual(expectedSecret, suppliedSecret))) return errorResponse("FORBIDDEN", "Worker authorization failed.", 403);

  const parsed = await readBoundedJsonObject<{ requestId?: unknown }>(request, { maxBytes: 512, allowedKeys: new Set(["requestId"]) });
  if (!parsed.ok) return parsed.response;
  const requestId = typeof parsed.body.requestId === "string" ? parsed.body.requestId : "";
  if (!uuidPattern.test(requestId)) return errorResponse("VALIDATION_ERROR", "A valid request ID is required.", 400);
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return errorResponse("INTERNAL_ERROR", "Finalization dependencies are unavailable.", 503);
  const operator = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: prepared, error: prepareError } = await operator.rpc("prepare_account_deletion_anonymization", { target_request_id: requestId });
  const preparedRow = Array.isArray(prepared) ? prepared[0] : prepared;
  if (prepareError || !preparedRow?.target_user_id) return errorResponse("VALIDATION_ERROR", "The deletion request is not eligible for finalization.", 409);

  const { error: authError } = await operator.auth.admin.deleteUser(preparedRow.target_user_id, true);
  if (authError) {
    await operator.from("account_deletion_requests").update({ finalization_status: "auth_soft_delete_failed" }).eq("id", requestId).eq("user_id", preparedRow.target_user_id);
    return errorResponse("INTERNAL_ERROR", "Profile anonymization completed, but Auth soft deletion requires operator retry.", 503);
  }

  const completedAt = new Date().toISOString();
  await operator.from("account_deletion_requests").update({ status: "completed", finalization_status: "completed", completed_at: completedAt }).eq("id", requestId).eq("user_id", preparedRow.target_user_id);
  await operator.from("account_security_events").insert({ user_id: preparedRow.target_user_id, event_type: "account_auth_soft_deleted", request_id: requestId, metadata: { stage: "completed" } });
  return jsonResponse({ status: "completed", requestId, completedAt }, { headers: { "Cache-Control": "no-store" } });
});
