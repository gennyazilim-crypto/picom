import { handleCorsPreflight } from "../_shared/cors.ts";
import { jsonResponse, methodNotAllowed } from "../_shared/http.ts";

type DependencyStatus = "ok" | "ok_placeholder" | "degraded" | "unavailable" | "not_required";

type HealthDependency = Readonly<{
  name: string;
  status: DependencyStatus;
  required: boolean;
  message: string;
}>;

const serviceName = "picom-edge-functions";
const functionName = "health";

function now(): string {
  return new Date().toISOString();
}

function readPublicEnv(name: string, fallback: string): string {
  const value = Deno.env.get(name);
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function toDependencyStatus(value: string): DependencyStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === "ok" || normalized === "healthy") return "ok";
  if (normalized === "ok_placeholder" || normalized === "placeholder") return "ok_placeholder";
  if (normalized === "degraded") return "degraded";
  if (normalized === "unavailable" || normalized === "down") return "unavailable";
  if (normalized === "not_required" || normalized === "optional" || normalized === "skipped") return "not_required";
  return "ok_placeholder";
}

function dependency(name: string, envName: string, required: boolean, fallback: DependencyStatus, message: string): HealthDependency {
  const claimed = toDependencyStatus(readPublicEnv(envName, fallback));
  // TASK34: env-claimed ok without an explicit probe flag is not production HEALTHY evidence.
  const probed = readPublicEnv(`PICOM_HEALTH_${name.toUpperCase()}_PROBED`, "false").toLowerCase() === "true";
  const status: DependencyStatus = (!probed && (claimed === "ok" || claimed === "ok_placeholder"))
    ? "ok_placeholder"
    : claimed;
  return {
    name,
    status,
    required,
    message,
  };
}

function getDependencies(): HealthDependency[] {
  return [
    dependency(
      "database",
      "PICOM_HEALTH_DATABASE_STATUS",
      true,
      "ok_placeholder",
      "Supabase Postgres reachability placeholder. Replace with a real DB probe before production orchestration depends on it.",
    ),
    dependency(
      "redis",
      "PICOM_HEALTH_REDIS_STATUS",
      false,
      "not_required",
      "Redis is optional for local/Supabase MVP mode and becomes required only for horizontally scaled realtime services.",
    ),
    dependency(
      "storage",
      "PICOM_HEALTH_STORAGE_STATUS",
      false,
      "ok_placeholder",
      "Supabase Storage reachability placeholder for image attachment delivery.",
    ),
    dependency(
      "realtime",
      "PICOM_HEALTH_REALTIME_STATUS",
      false,
      "ok_placeholder",
      "Supabase Realtime initialization placeholder.",
    ),
  ];
}

function isPlaceholder(status: DependencyStatus): boolean {
  return status === "ok_placeholder";
}

function isReady(dependencies: readonly HealthDependency[]): boolean {
  // Placeholders are not production readiness evidence (TASK34: no fake health).
  return dependencies.every((item) => {
    if (!item.required) return true;
    if (isPlaceholder(item.status)) return false;
    return item.status !== "unavailable" && item.status !== "degraded";
  });
}

function hasDependencyDegradation(dependencies: readonly HealthDependency[]): boolean {
  return dependencies.some((item) =>
    item.status === "unavailable"
    || item.status === "degraded"
    || (item.required && isPlaceholder(item.status))
  );
}

function liveResponse(): Response {
  return jsonResponse({
    ok: true,
    status: "live",
    service: serviceName,
    function: functionName,
    checks: [
      {
        name: "process",
        status: "ok",
        required: true,
        message: "Edge Function process is running.",
      },
    ],
    timestamp: now(),
  });
}

function readyResponse(): Response {
  const dependencies = getDependencies();
  const ready = isReady(dependencies);
  const degraded = hasDependencyDegradation(dependencies);

  return jsonResponse(
    {
      ok: ready,
      status: ready ? "ready" : "not_ready",
      degraded,
      service: serviceName,
      function: functionName,
      dependencies,
      message: ready
        ? "Required dependencies are ready. Optional dependencies can be degraded while readiness remains successful."
        : "A required dependency is not ready.",
      timestamp: now(),
    },
    { status: ready ? 200 : 503 },
  );
}

function combinedHealthResponse(): Response {
  const dependencies = getDependencies();
  const ready = isReady(dependencies);
  const degraded = hasDependencyDegradation(dependencies);
  const status = ready ? (degraded ? "degraded" : "operational") : "degraded";

  const hasPlaceholders = dependencies.some((item) => isPlaceholder(item.status));
  return jsonResponse({
    ok: true,
    status: hasPlaceholders ? "unknown" : status,
    message: hasPlaceholders
      ? "Dependency probes use env placeholders; do not treat as production HEALTHY evidence. Use admin-health / live-now-ops-status for real probes."
      : ready && !degraded
      ? "Picom services are operational."
      : ready
        ? "Picom required services are ready, but one or more optional services are degraded."
        : "Picom readiness checks are degraded.",
    startedAt: null,
    estimatedEndAt: null,
    service: serviceName,
    function: functionName,
    live: {
      ok: true,
      status: "live",
    },
    ready: {
      ok: ready,
      status: ready ? "ready" : "not_ready",
      degraded,
    },
    dependencies,
    endpoints: ["/health", "/health/live", "/health/ready"],
    timestamp: now(),
    evidence_note: "LIVENESS_ONLY_UNLESS_REAL_PROBES_CONFIGURED",
  });
}

function routePath(request: Request): "health" | "live" | "ready" {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
  if (pathname.endsWith("/health/live")) return "live";
  if (pathname.endsWith("/health/ready")) return "ready";
  return "health";
}

Deno.serve((request: Request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  if (request.method !== "GET") {
    return methodNotAllowed(["GET", "OPTIONS"]);
  }

  const route = routePath(request);
  if (route === "live") return liveResponse();
  if (route === "ready") return readyResponse();

  return combinedHealthResponse();
});
