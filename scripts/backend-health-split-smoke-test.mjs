import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const files = {
  health: "supabase/functions/health/index.ts",
  docs: "docs/deployment-backend.md",
  edgeDocs: "docs/edge-functions.md",
  readme: "supabase/functions/README.md",
  packageJson: "package.json",
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

const required = {
  health: [
    "routePath",
    "/health/live",
    "/health/ready",
    "readyResponse",
    "liveResponse",
    "combinedHealthResponse",
    "PICOM_HEALTH_DATABASE_STATUS",
    "PICOM_HEALTH_STORAGE_STATUS",
    "PICOM_HEALTH_REALTIME_STATUS",
    "PICOM_HEALTH_REDIS_STATUS",
    "status: ready ? 200 : 503",
  ],
  docs: [
    "Backend Deployment Notes",
    "GET /functions/v1/health/live",
    "GET /functions/v1/health/ready",
    "GET /functions/v1/health",
    "Returns `503`",
    "PICOM_HEALTH_DATABASE_STATUS",
    "Production hardening TODO",
  ],
  edgeDocs: ["/health/live", "/health/ready"],
  readme: ["/functions/v1/health/live", "/functions/v1/health/ready"],
  packageJson: ["backend:health:smoke"],
};

const missing = [];
for (const [key, phrases] of Object.entries(required)) {
  for (const phrase of phrases) {
    if (!text[key].includes(phrase)) {
      missing.push(`${files[key]} missing: ${phrase}`);
    }
  }
}

const forbidden = [/SERVICE_ROLE\s*=\s*[^<\s]/i, /LIVEKIT_API_SECRET\s*=\s*[^<\s]/i, /password\s*[:=]\s*['\"][^'\"]+['\"]/i];
const allText = Object.values(text).join("\n");
for (const pattern of forbidden) {
  if (pattern.test(allText)) {
    missing.push(`forbidden secret-like text matched: ${pattern}`);
  }
}

if (missing.length > 0) {
  console.error("Backend health split smoke test failed:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Backend health split smoke test passed.");

