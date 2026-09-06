import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

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

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);
  if (requiredEnv("ACCOUNT_DELETION_FINALIZATION_ENABLED") !== "true") {
    return errorResponse("FORBIDDEN", "Account finalization is disabled pending legal and operations approval.", 503);
  }
  const expectedSecret = requiredEnv("ACCOUNT_DELETION_WORKER_SECRET");
  const suppliedSecret = request.headers.get("x-picom-worker-secret") ?? "";
  if (!expectedSecret || !suppliedSecret || !(await safeEqual(expectedSecret, suppliedSecret))) {
    return errorResponse("FORBIDDEN", "Worker authorization failed.", 403);
  }
  const parsed = await readBoundedJsonObject<{ batchLimit?: unknown }>(request, { maxBytes: 256, allowedKeys: new Set(["batchLimit"]) });
  if (!parsed.ok) return parsed.response;
  const batchLimit = typeof parsed.body.batchLimit === "number" && Number.isInteger(parsed.body.batchLimit)
    ? Math.max(1, Math.min(parsed.body.batchLimit, 100))
    : 25;
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return errorResponse("INTERNAL_ERROR", "Finalization dependencies are unavailable.", 503);
  const operator = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: prepared, error: prepareError } = await operator.rpc("finalize_due_account_deletions", { batch_limit: batchLimit });
  if (prepareError) return errorResponse("INTERNAL_ERROR", "Due account deletions could not be prepared safely.", 409);

  const completed: string[] = [];
  const failed: string[] = [];
  for (const row of Array.isArray(prepared) ? prepared : []) {
    if (!row?.request_id || !row?.target_user_id) continue;
    const { error: signOutError } = await operator.auth.admin.signOut(row.target_user_id, "global");
    const { error: authError } = signOutError ? { error: signOutError } : await operator.auth.admin.deleteUser(row.target_user_id, true);
    if (authError) {
      await operator.from("account_deletion_requests").update({ finalization_status: "auth_soft_delete_failed" }).eq("id", row.request_id).eq("user_id", row.target_user_id);
      failed.push(row.request_id);
      continue;
    }
    const { error: completeError } = await operator.rpc("complete_account_deletion_finalization", {
      target_request_id: row.request_id,
      target_user_id: row.target_user_id,
    });
    if (completeError) {
      failed.push(row.request_id);
      continue;
    }
    completed.push(row.request_id);
  }

  return jsonResponse({ completed, failed }, { headers: { "Cache-Control": "no-store" } });
});
