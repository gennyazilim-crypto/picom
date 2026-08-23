import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

type Input = { verificationId?: string; domain?: string };
function privateAddress(address: string): boolean {
  const value = address.toLowerCase();
  return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:")
    || /^(127|10)\./.test(value) || /^192\.168\./.test(value) || /^172\.(1[6-9]|2\d|3[01])\./.test(value)
    || /^169\.254\./.test(value) || value === "0.0.0.0";
}
function validDomain(domain: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain)
    && !/(^|\.)(localhost|local|internal|test)$/.test(domain.toLowerCase());
}

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request); if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);
  const auth = await requireSupabaseUser(request); if (!auth.ok) return auth.response;
  if (Deno.env.get("BUSINESS_DOMAIN_VERIFICATION_ENABLED") !== "true") {
    return errorResponse("NOT_CONFIGURED", "Domain verification is not configured.", 503);
  }
  const body = await readBoundedJsonObject<Input>(request, { maxBytes: 2048, allowedKeys: new Set(["verificationId", "domain"]) });
  if (!body.ok) return body.response;
  const domain = body.body.domain?.trim().toLowerCase() ?? "";
  if (!body.body.verificationId || !validDomain(domain)) return errorResponse("VALIDATION_ERROR", "A public domain and verification id are required.", 400);
  try {
    const records = await Deno.resolveDns(domain, "A");
    if (records.some(privateAddress)) return errorResponse("BLOCKED", "Private network destinations are not eligible for verification.", 400);
  } catch {
    return errorResponse("BLOCKED", "The domain could not be safely resolved.", 400);
  }
  // DNS/email verification integrations are intentionally not implemented here.
  // Do not update the verification record until a provider proves control.
  return errorResponse("BLOCKED", "Domain verification provider is unavailable; no verification status changed.", 503);
});
