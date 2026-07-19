import { requireSupabaseUser } from "../_shared/auth.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { createLiveKitServerAdminToken } from "../_shared/livekit-token.ts";

type LiveKitState = "operational" | "unavailable" | "not_configured";
type DeploymentType = "self_hosted" | "cloud" | "not_configured";

function env(name: string): string {
  return Deno.env.get(name)?.trim() ?? "";
}

function boolEnv(name: string): boolean {
  return env(name).toLowerCase() === "true";
}

function resolveDeployment(liveKitUrl: string): DeploymentType {
  const configured = env("PICOM_LIVEKIT_DEPLOYMENT").toLowerCase();
  if (configured === "self_hosted" || configured === "cloud") return configured;
  if (!liveKitUrl) return "not_configured";
  try { return /(^|\.)livekit\.cloud$/i.test(new URL(liveKitUrl).hostname) ? "cloud" : "self_hosted"; }
  catch { return "not_configured"; }
}

function roomServiceUrl(liveKitUrl: string): string | null {
  try {
    const url = new URL(liveKitUrl);
    if (url.protocol === "wss:") url.protocol = "https:";
    else if (url.protocol === "ws:") url.protocol = "http:";
    else if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.pathname = "/twirp/livekit.RoomService/ListRooms";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

async function probeLiveKit(): Promise<{ state: LiveKitState; latencyMs: number | null }> {
  const liveKitUrl = env("LIVEKIT_URL");
  const apiKey = env("LIVEKIT_API_KEY");
  const apiSecret = env("LIVEKIT_API_SECRET");
  const endpoint = roomServiceUrl(liveKitUrl);
  if (!liveKitUrl || !apiKey || !apiSecret) return { state: "not_configured", latencyMs: null };
  if (!endpoint) return { state: "unavailable", latencyMs: null };

  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const { token } = await createLiveKitServerAdminToken({ apiKey, apiSecret });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal,
    });
    return { state: response.ok ? "operational" : "unavailable", latencyMs: Math.max(0, Math.round(performance.now() - startedAt)) };
  } catch {
    return { state: "unavailable", latencyMs: Math.max(0, Math.round(performance.now() - startedAt)) };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;
  const { data: isAdmin, error: accessError } = await auth.supabase.rpc("is_app_admin");
  if (accessError || isAdmin !== true) return errorResponse("AUTH_INVALID", "App administrator access is required.", 403);

  const { data: databaseStatus, error: databaseError } = await auth.supabase.rpc("get_admin_system_status_v2");
  if (databaseError || !databaseStatus) return errorResponse("INTERNAL_ERROR", "Database health is unavailable.", 503);

  const liveKitUrl = env("LIVEKIT_URL");
  const deployment = resolveDeployment(liveKitUrl);
  const livekit = await probeLiveKit();
  const turn = env("PICOM_LIVEKIT_TURN_DOMAIN") ? "configured" as const : "not_configured" as const;
  const redis = boolEnv("PICOM_LIVEKIT_REDIS_CONFIGURED") ? "configured" as const : "not_configured" as const;
  const operational = deployment === "self_hosted" && livekit.state === "operational" && turn === "configured" && redis === "configured";

  return jsonResponse({
    overall: operational ? "operational" : livekit.state === "not_configured" ? "not_configured" : "degraded",
    deployment,
    database: "operational",
    livekit: livekit.state,
    turn,
    redis,
    livekitLatencyMs: livekit.latencyMs,
    checkedAt: new Date().toISOString(),
    source: "admin_health_edge",
  }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
});
