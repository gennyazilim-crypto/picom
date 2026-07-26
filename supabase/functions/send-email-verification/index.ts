import { requireSupabaseUser } from "../_shared/auth.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import {
  createServiceClient,
  issueAndSendVerification,
  maskEmail,
  normalizeEmail,
} from "../_shared/soft-email-verification.ts";

Deno.serve(async (request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const email = auth.user.email ? normalizeEmail(auth.user.email) : "";
  if (!email) return errorResponse("VALIDATION_ERROR", "Your account does not have an email address.", 400);

  let admin;
  try {
    admin = createServiceClient();
  } catch {
    return errorResponse("INTERNAL_ERROR", "Verification service is temporarily unavailable.", 503);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name,email_verification_status")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.email_verification_status === "verified") {
    return jsonResponse({
      ok: true,
      alreadyVerified: true,
      emailMasked: maskEmail(email),
      message: "Email is already verified.",
    });
  }

  const displayName =
    typeof profile?.display_name === "string" && profile.display_name.trim()
      ? profile.display_name.trim()
      : "PICOM kullanıcısı";

  const result = await issueAndSendVerification(
    admin,
    auth.user.id,
    email,
    displayName,
    "email_verification_sent",
  );

  if (!result.ok) {
    if (result.code === "RATE_LIMITED") {
      return errorResponse("RATE_LIMITED", result.message, 429);
    }
    if (result.code === "DELIVERY_FAILED") {
      return errorResponse("DELIVERY_FAILED", result.message, 502);
    }
    return errorResponse("INTERNAL_ERROR", result.message, 500);
  }

  return jsonResponse({
    ok: true,
    alreadyVerified: false,
    emailMasked: result.emailMasked,
    message: "If verification is needed, a message was sent.",
  });
});
