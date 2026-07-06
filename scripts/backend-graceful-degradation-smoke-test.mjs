import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const files = {
  doc: "docs/backend-graceful-degradation.md",
  health: "supabase/functions/health/index.ts",
  deployment: "docs/deployment-backend.md",
  packageJson: "package.json",
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));

const required = {
  doc: [
    "Backend Graceful Degradation",
    "Critical vs optional services",
    "Supabase Auth",
    "Supabase Postgres/RLS",
    "Supabase Storage",
    "Supabase Realtime",
    "LiveKit",
    "Redis",
    "Optional service failures should",
    "Remote config/status exposure",
  ],
  health: [
    "hasDependencyDegradation",
    "const degraded = hasDependencyDegradation(dependencies)",
    "ready ? (degraded ? \"degraded\" : \"operational\") : \"degraded\"",
    "Optional dependencies can be degraded while readiness remains successful.",
  ],
  deployment: ["docs/backend-graceful-degradation.md"],
  packageJson: ["backend:degradation:smoke"],
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
  console.error("Backend graceful degradation smoke test failed:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Backend graceful degradation smoke test passed.");

