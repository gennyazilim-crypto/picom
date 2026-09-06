import { requireSupabaseUser } from "../_shared/auth.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";
import {
  accountCenterUrl,
  createServiceClient,
  generateOpaqueToken,
  sha256Hex,
  sendAccountDeletionConfirmationEmail,
} from "../_shared/soft-email-verification.ts";

type RequestBody = { action?: "request" | "cancel" | "confirm"; token?: string };

function safeDatabaseMessage(message: string | undefined): string {
  if (message?.includes("OWNERSHIP_TRANSFER_REQUIRED")) return "Transfer ownership of every community before deleting your account.";
  if (message?.includes("NO_ACTIVE_DELETION_REQUEST")) return "No active account deletion request was found.";
  if (message?.includes("ACCOUNT_NOT_ACTIVE")) return "This account is not available for deletion.";
  if (message?.includes("DELETION_CONFIRMATION_EXPIRED")) return "This deletion confirmation link has expired. Request a new one from Account Center.";
  if (message?.includes("DELETION_CONFIRMATION_ALREADY_USED")) return "This deletion confirmation link has already been used.";
  if (message?.includes("INVALID_DELETION_CONFIRMATION")) return "This deletion confirmation link is invalid.";
  return "PICOM could not update the account deletion request safely.";
}

function isPlausibleToken(value: unknown): value is string {
  return typeof value === "string" && value.length >= 32 && value.length <= 256 && /^[A-Za-z0-9_-]+$/.test(value);
}

function isWithinOneMinute(value: string | null | undefined): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && Date.now() - timestamp < 60_000;
}

async function confirmDeletion(rawToken: string): Promise<Response> {
  if (!isPlausibleToken(rawToken)) return errorResponse("VALIDATION_ERROR", "This deletion confirmation link is invalid.", 400);
  let operator: ReturnType<typeof createServiceClient>;
  try {
    operator = createServiceClient();
  } catch {
    return errorResponse("INTERNAL_ERROR", "Account deletion confirmation is temporarily unavailable.", 503);
  }
  const tokenHash = await sha256Hex(rawToken);
  const { data, error } = await operator.rpc("confirm_account_deletion_email_confirmation", { target_token_hash: tokenHash });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.request_id || !row?.scheduled_deletion_at) {
    return errorResponse("VALIDATION_ERROR", safeDatabaseMessage(error?.message), 409);
  }
  return jsonResponse({ status: "pending_deletion", requestId: row.request_id, scheduledDeletionAt: row.scheduled_deletion_at }, { headers: { "Cache-Control": "no-store" } });
}

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const parsed = await readBoundedJsonObject<RequestBody>(request, { maxBytes: 1024, allowedKeys: new Set(["action", "token"]) });
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  // This is the one unauthenticated action: a cryptographically random,
  // single-use email bearer credential is SHA-256 hashed before database lookup.
  if (body.action === "confirm") return confirmDeletion(body.token ?? "");

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  if (body.action === "cancel") {
    const { data, error } = await auth.supabase.rpc("cancel_current_user_account_deletion");
    if (error) return errorResponse("VALIDATION_ERROR", safeDatabaseMessage(error.message), 409);
    const row = Array.isArray(data) ? data[0] : data;
    return jsonResponse({ status: "canceled", requestId: row?.request_id ?? null, canceledAt: row?.canceled_at ?? null }, { headers: { "Cache-Control": "no-store" } });
  }

  if (body.action !== "request") return errorResponse("VALIDATION_ERROR", "A valid account deletion action is required.", 400);
  if (!auth.user.email) return errorResponse("VALIDATION_ERROR", "A verified account email is required to request deletion.", 409);

  const { data: beginData, error: beginError } = await auth.supabase.rpc("begin_current_user_account_deletion");
  const beginRow = Array.isArray(beginData) ? beginData[0] : beginData;
  if (beginError || !beginRow?.request_id) return errorResponse("VALIDATION_ERROR", safeDatabaseMessage(beginError?.message), 409);

  const { data: statusData, error: statusError } = await auth.supabase.rpc("get_current_user_account_deletion_status");
  const currentStatus = Array.isArray(statusData) ? statusData[0] : statusData;
  if (statusError || !currentStatus?.status) return errorResponse("INTERNAL_ERROR", "Account deletion status is temporarily unavailable.", 503);
  if (currentStatus.status === "pending_deletion") {
    return jsonResponse({ status: "pending_deletion", requestId: currentStatus.request_id, scheduledDeletionAt: currentStatus.scheduled_deletion_at }, { headers: { "Cache-Control": "no-store" } });
  }
  if (currentStatus.status !== "email_pending") return errorResponse("VALIDATION_ERROR", "PICOM could not update the account deletion request safely.", 409);

  let operator: ReturnType<typeof createServiceClient>;
  try {
    operator = createServiceClient();
  } catch {
    return errorResponse("INTERNAL_ERROR", "Account deletion email confirmation is temporarily unavailable.", 503);
  }

  const { data: recentConfirmation, error: recentConfirmationError } = await operator
    .from("account_deletion_email_confirmations")
    .select("sent_at")
    .eq("request_id", beginRow.request_id)
    .is("confirmed_at", null)
    .is("invalidated_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentConfirmationError) return errorResponse("INTERNAL_ERROR", "Account deletion email confirmation is temporarily unavailable.", 503);
  if (isWithinOneMinute(recentConfirmation?.sent_at)) {
    return errorResponse("RATE_LIMITED", "Wait briefly before requesting another deletion confirmation email.", 429);
  }

  const token = generateOpaqueToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error: issueError } = await operator.rpc("issue_account_deletion_email_confirmation", {
    target_request_id: beginRow.request_id,
    target_user_id: auth.user.id,
    target_token_hash: tokenHash,
    target_expires_at: expiresAt,
  });
  if (issueError) return errorResponse("INTERNAL_ERROR", "Account deletion email confirmation is temporarily unavailable.", 503);

  const { data: profile } = await operator.from("profiles").select("display_name").eq("id", auth.user.id).maybeSingle();
  const confirmUrl = `${accountCenterUrl()}/delete-confirmation?token=${encodeURIComponent(token)}`;
  const sent = await sendAccountDeletionConfirmationEmail({
    to: auth.user.email,
    displayName: profile?.display_name ?? "PICOM user",
    confirmUrl,
    expiresAt,
  });
  if (!sent.ok) {
    await operator.rpc("invalidate_account_deletion_email_confirmation", {
      target_request_id: beginRow.request_id,
      target_user_id: auth.user.id,
      failure_reason: sent.message,
    });
    return errorResponse("INTERNAL_ERROR", "The deletion confirmation email could not be sent. Please try again.", 503);
  }

  return jsonResponse({ status: "email_pending", requestId: beginRow.request_id, expiresAt }, { headers: { "Cache-Control": "no-store" } });
});
