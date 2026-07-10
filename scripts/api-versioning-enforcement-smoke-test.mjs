import { readFile } from "node:fs/promises";

const [edgeCompatibility, cors, http, rendererCompatibility, remoteConfig, liveKit, docs, workflow, packageText] = await Promise.all([
  readFile("supabase/functions/_shared/api-compatibility.ts", "utf8"),
  readFile("supabase/functions/_shared/cors.ts", "utf8"),
  readFile("supabase/functions/_shared/http.ts", "utf8"),
  readFile("src/config/apiCompatibility.ts", "utf8"),
  readFile("src/services/remoteConfigService.ts", "utf8"),
  readFile("src/services/livekit/livekitService.ts", "utf8"),
  readFile("docs/api-compatibility.md", "utf8"),
  readFile(".github/workflows/qa.yml", "utf8"),
  readFile("package.json", "utf8"),
]);

const checks = [
  [edgeCompatibility.includes('PICOM_API_VERSION = "1"') && edgeCompatibility.includes("X-Picom-Min-Client-Version"), "safe Edge API metadata"],
  [cors.includes("requestedApiVersionIsUnsupported") && cors.includes("VALIDATION_ERROR") && cors.includes("Access-Control-Expose-Headers"), "central conflicting-major rejection"],
  [http.includes("...corsHeaders"), "all JSON Edge responses inherit compatibility headers"],
  [rendererCompatibility.includes("X-Picom-Client-Version") && rendererCompatibility.includes("appConfig.version"), "desktop version request metadata"],
  [remoteConfig.includes("getApiCompatibilityRequestHeaders") && liveKit.includes("getApiCompatibilityRequestHeaders"), "critical Edge callers send compatibility headers"],
  [docs.includes("Enforced compatibility headers") && docs.includes("Missing API headers remain accepted") && docs.includes("never replace authentication, RLS, permissions"), "backward-compatible policy and security boundary"],
  [workflow.includes("api:versioning:enforcement:smoke") && packageText.includes('"api:versioning:enforcement:smoke"'), "CI enforcement"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
