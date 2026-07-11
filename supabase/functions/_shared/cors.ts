import { apiCompatibilityHeaders, PICOM_API_VERSION, requestedApiVersionIsUnsupported } from "./api-compatibility.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-picom-webhook-token, x-picom-api-version, x-picom-client-version, idempotency-key",
  "Access-Control-Expose-Headers": "X-Picom-API-Version, X-Picom-API-Revision, X-Picom-Min-Client-Version, X-Picom-Recommended-Client-Version, Deprecation, Sunset, Link",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  ...apiCompatibilityHeaders(),
};

function allowedOrigins(): Set<string> {
  return new Set((Deno.env.get("PICOM_ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
}

function headersForOrigin(origin: string | null): HeadersInit {
  return { ...corsHeaders, ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}) };
}

export function handleCorsPreflight(request: Request): Response | null {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins().has(origin)) {
    return new Response(JSON.stringify({ code: "FORBIDDEN", message: "Origin is not allowed." }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin" },
    });
  }

  if (request.method !== "OPTIONS" && requestedApiVersionIsUnsupported(request)) {
    return new Response(JSON.stringify({
      code: "VALIDATION_ERROR",
      message: "The requested Picom API version is not supported.",
      details: { supportedApiVersions: [PICOM_API_VERSION] },
    }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headersForOrigin(origin) },
    });
  }

  if (request.method !== "OPTIONS") return null;

  return new Response("ok", {
    headers: headersForOrigin(origin),
  });
}
