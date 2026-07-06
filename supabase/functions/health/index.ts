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
  return {
    name,
    status: toDependencyStatus(readPublicEnv(envName, fallback)),
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

function isReady(dependencies: readonly HealthDependency[]): boolean {
  return dependencies.every((item) => !item.required || (item.status !== "unavailable" && item.status !== "degraded"));
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

  return jsonResponse(
    {
      ok: ready,
      status: ready ? "ready" : "not_ready",
      service: serviceName,
      function: functionName,
      dependencies,
      timestamp: now(),
    },
    { status: ready ? 200 : 503 },
  );
}

function combinedHealthResponse(): Response {
  const dependencies = getDependencies();
  const ready = isReady(dependencies);

  return jsonResponse({
    ok: true,
    status: ready ? "operational" : "degraded",
    message: ready ? "Picom services are operational." : "Picom readiness checks are degraded.",
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
    },
    dependencies,
    endpoints: ["/health", "/health/live", "/health/ready"],
    timestamp: now(),
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
