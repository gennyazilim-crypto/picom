export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function handleCorsPreflight(request: Request): Response | null {
  if (request.method !== "OPTIONS") return null;

  return new Response("ok", {
    headers: corsHeaders,
  });
}
