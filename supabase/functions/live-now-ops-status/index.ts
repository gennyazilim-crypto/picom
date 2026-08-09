import { requireSupabaseUser } from "../_shared/auth.ts";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { createLiveKitServerAdminToken } from "../_shared/livekit-token.ts";

type ProbeState = "HEALTHY" | "UNAVAILABLE" | "NOT_CONFIGURED" | "UNKNOWN";

function env(name: string): string {
  return Deno.env.get(name)?.trim() ?? "";
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
  } catch {
    return null;
  }
}

async function probeLiveKit(): Promise<{ state: ProbeState; latencyMs: number | null }> {
  const liveKitUrl = env("LIVEKIT_URL");
  const apiKey = env("LIVEKIT_API_KEY");
  const apiSecret = env("LIVEKIT_API_SECRET");
  const endpoint = roomServiceUrl(liveKitUrl);
  if (!liveKitUrl || !apiKey || !apiSecret) return { state: "NOT_CONFIGURED", latencyMs: null };
  if (!endpoint) return { state: "UNAVAILABLE", latencyMs: null };

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
    return {
      state: response.ok ? "HEALTHY" : "UNAVAILABLE",
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };
  } catch {
    return { state: "UNAVAILABLE", latencyMs: Math.max(0, Math.round(performance.now() - startedAt)) };
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

  const { data: status, error: statusError } = await auth.supabase.rpc("get_live_now_ops_status");
  if (statusError || !status) {
    return errorResponse("OPS_ADMIN_REQUIRED", "Live Now ops status requires Root/admin access.", 403);
  }

  const livekit = await probeLiveKit();
  const payload = typeof status === "object" && status !== null ? status as Record<string, unknown> : {};
  const services = typeof payload.services === "object" && payload.services !== null
    ? { ...(payload.services as Record<string, unknown>) }
    : {};

  services.LIVEKIT_SFU = {
    ...(typeof services.LIVEKIT_SFU === "object" && services.LIVEKIT_SFU !== null
      ? services.LIVEKIT_SFU as Record<string, unknown>
      : {}),
    status: livekit.state,
    latency_ms: livekit.latencyMs,
    certification: "SIGNALING_PROBE_ONLY; REAL_TWO_DESKTOP_MEDIA_NOT_CERTIFIED",
  };

  return jsonResponse({
    ...payload,
    services,
    livekit_probe: {
      status: livekit.state,
      latency_ms: livekit.latencyMs,
      media_canary: "NOT_RUN",
      obs_canary: "NOT_RUN",
    },
    source: "live_now_ops_status_edge",
    checkedAt: new Date().toISOString(),
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
