import { handleCorsPreflight } from "../_shared/cors.ts";
import { jsonResponse, methodNotAllowed } from "../_shared/http.ts";

Deno.serve((request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  if (request.method !== "GET") {
    return methodNotAllowed(["GET", "OPTIONS"]);
  }

  return jsonResponse({
    ok: true,
    status: "operational",
    message: "Picom services are operational.",
    startedAt: null,
    estimatedEndAt: null,
    service: "picom-edge-functions",
    function: "health",
    timestamp: new Date().toISOString(),
  });
});
