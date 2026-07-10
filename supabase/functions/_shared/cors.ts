import { apiCompatibilityHeaders, PICOM_API_VERSION, requestedApiVersionIsUnsupported } from "./api-compatibility.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-picom-webhook-token, x-picom-api-version, x-picom-client-version, idempotency-key",
  "Access-Control-Expose-Headers": "X-Picom-API-Version, X-Picom-API-Revision, X-Picom-Min-Client-Version, X-Picom-Recommended-Client-Version, Deprecation, Sunset, Link",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  ...apiCompatibilityHeaders(),
};

export function handleCorsPreflight(request: Request): Response | null {
  if (request.method !== "OPTIONS" && requestedApiVersionIsUnsupported(request)) {
    return new Response(JSON.stringify({
      code: "VALIDATION_ERROR",
      message: "The requested Picom API version is not supported.",
      details: { supportedApiVersions: [PICOM_API_VERSION] },
    }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (request.method !== "OPTIONS") return null;

  return new Response("ok", {
    headers: corsHeaders,
  });
}
