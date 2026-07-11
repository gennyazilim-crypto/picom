import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

type RequestBody = {
  action?: "request" | "cancel";
  confirmationUsername?: string;
};

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

function safeDatabaseMessage(message: string | undefined): string {
  if (message?.includes("OWNERSHIP_TRANSFER_REQUIRED")) return "Transfer ownership of every community before deleting your account.";
  if (message?.includes("CONFIRMATION_MISMATCH")) return "Type your exact username to confirm account deletion.";
  if (message?.includes("NO_ACTIVE_DELETION_REQUEST")) return "No active account deletion request was found.";
  if (message?.includes("REAUTH_REQUIRED")) return "Re-enter your password and try again. Account deletion requires a recent sign-in.";
  return "Picom could not update the account deletion request safely.";
}

Deno.serve(async (request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const parsed = await readBoundedJsonObject<RequestBody>(request, { maxBytes: 1024, allowedKeys: new Set(["action", "confirmationUsername"]) });
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  if (body.action === "cancel") {
    const { data, error } = await auth.supabase.rpc("cancel_current_user_account_deletion");
    if (error) return errorResponse("VALIDATION_ERROR", safeDatabaseMessage(error.message), 409);
    const row = Array.isArray(data) ? data[0] : data;
    return jsonResponse({ status: "canceled", requestId: row?.request_id ?? null, canceledAt: row?.canceled_at ?? new Date().toISOString() });
  }

  const confirmationUsername = body.confirmationUsername?.trim();
  if (body.action !== "request" || !confirmationUsername || confirmationUsername.length > 64) {
    return errorResponse("VALIDATION_ERROR", "Type your exact username to confirm account deletion.", 400);
  }

  const { data, error } = await auth.supabase.rpc("request_current_user_account_deletion", {
    confirmation_username: confirmationUsername,
  });
  if (error) return errorResponse("VALIDATION_ERROR", safeDatabaseMessage(error.message), 409);

  const row = Array.isArray(data) ? data[0] : data;
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !serviceRoleKey || !authorization || !row?.request_id) {
    return errorResponse("INTERNAL_ERROR", "The deletion request is safe, but session revocation requires operator review.", 503);
  }

  const logoutResponse = await fetch(`${supabaseUrl}/auth/v1/logout?scope=global`, {
    method: "POST",
    headers: { Authorization: authorization, apikey: serviceRoleKey },
  });

  const operator = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!logoutResponse.ok) {
    await operator
      .from("account_deletion_requests")
      .update({ session_revocation_status: "failed" })
      .eq("id", row.request_id)
      .eq("user_id", auth.user.id);
    return errorResponse("INTERNAL_ERROR", "The deletion request is safe, but Picom could not revoke every session. Contact support before continuing.", 503);
  }

  const revokedAt = new Date().toISOString();
  await operator
    .from("account_deletion_requests")
    .update({ session_revocation_status: "completed", sessions_revoked_at: revokedAt })
    .eq("id", row.request_id)
    .eq("user_id", auth.user.id);
  await operator.from("account_security_events").insert({
    user_id: auth.user.id,
    event_type: "account_sessions_revoked",
    request_id: row.request_id,
    metadata: { scope: "global" },
  });

  return jsonResponse({
    status: "requested",
    requestId: row.request_id,
    requestedAt: row.requested_at,
    anonymizeAfter: row.anonymize_after,
    sessionsRevokedAt: revokedAt,
  });
});
