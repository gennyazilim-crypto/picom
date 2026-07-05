import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoots = ["src", "electron"];
const allowedRedactionFiles = new Set([
  "src\\services\\loggingService.ts",
  "src/services/loggingService.ts"
]);
const scannedExtensions = new Set([".ts", ".tsx", ".cts", ".mts", ".js", ".mjs"]);
const dangerousPatterns = [
  /SUPABASE_SERVICE_ROLE/i,
  /SERVICE_ROLE_KEY/i,
  /LIVEKIT_API_SECRET/i,
  /LIVEKIT_SECRET/i,
  /SIGNING_KEY/i,
  /PRIVATE_KEY/i,
  /AUTH_TOKEN\s*=/i,
  /PASSWORD\s*=/i,
  /COOKIE\s*=/i,
  /AUTHORIZATION\s*=/i
];

function hasScannedExtension(path) {
  return [...scannedExtensions].some((extension) => path.endsWith(extension));
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      walk(path, files);
    } else if (hasScannedExtension(path)) {
      files.push(path);
    }
  }

  return files;
}

const findings = [];

for (const runtimeRoot of runtimeRoots) {
  for (const file of walk(resolve(root, runtimeRoot))) {
    const relativePath = relative(root, file);
    if (allowedRedactionFiles.has(relativePath)) continue;

    const source = readFileSync(file, "utf8");
    for (const pattern of dangerousPatterns) {
      if (pattern.test(source)) {
        findings.push(`${relativePath}: ${pattern}`);
      }
    }
  }
}

if (findings.length) {
  throw new Error(`Potential secret exposure in runtime files:\n${findings.join("\n")}`);
}

console.log("✓ runtime secret exposure scan");
console.log("✓ no service-role/livekit/signing secrets in runtime code");
console.log("✓ secret exposure smoke test completed");
