import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoots = ["src", "electron"];
const allowedRedactionFiles = new Set([
  "src\\services\\loggingService.ts",
  "src/services/loggingService.ts",
  "src\\services\\logging\\loggingService.ts",
  "src/services/logging/loggingService.ts"
]);
const scannedExtensions = new Set([".ts", ".tsx", ".cts", ".mts", ".js", ".mjs"]);

/**
 * Secret-assignment detectors. `document.cookie =` is a browser cookie write, not
 * secret material, so it is excluded. Cookie/session *secret* identifiers still fail.
 */
const dangerousPatterns = [
  /SUPABASE_SERVICE_ROLE/i,
  /SERVICE_ROLE_KEY/i,
  /LIVEKIT_API_SECRET/i,
  /LIVEKIT_SECRET/i,
  /SIGNING_KEY/i,
  /PRIVATE_KEY/i,
  /AUTH_TOKEN\s*=/i,
  /\bPASSWORD\s*=/i,
  /(?<!document\.)\bCOOKIE\s*=/i,
  /(?:SESSION_COOKIE|AUTH_COOKIE|COOKIE_SECRET|COOKIE_KEY|SECURE_COOKIE)\s*=/i,
  /AUTHORIZATION\s*=/i
];

function matchesDangerousPattern(source) {
  return dangerousPatterns.some((pattern) => pattern.test(source));
}

function matchingPatternLabels(source) {
  return dangerousPatterns.filter((pattern) => pattern.test(source)).map(String);
}

function assertCookieSessionSecretRegression() {
  const mustFail = [
    'const COOKIE = "s3cret-value"',
    "SESSION_COOKIE='abc'",
    "AUTH_COOKIE = 'x'",
    "COOKIE_SECRET=placeholder",
    "COOKIE_KEY=placeholder",
    "SECURE_COOKIE=placeholder",
    "export const COOKIE = process.env.COOKIE",
  ];
  const mustPass = [
    'document.cookie = `${encodeURIComponent(CONSENT_STORAGE_KEY)}=${choice}; Path=/`',
    "const value = document.cookie",
    "const CONSENT_STORAGE_KEY = 'picom.marketing.consent'",
  ];

  for (const sample of mustFail) {
    assert.equal(
      matchesDangerousPattern(sample),
      true,
      `cookie/session secret sample must still fail: ${sample}`,
    );
  }
  for (const sample of mustPass) {
    assert.equal(
      matchesDangerousPattern(sample),
      false,
      `consent/document.cookie sample must not fail: ${sample}`,
    );
  }
}

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

assertCookieSessionSecretRegression();

const findings = [];

for (const runtimeRoot of runtimeRoots) {
  for (const file of walk(resolve(root, runtimeRoot))) {
    const relativePath = relative(root, file);
    if (allowedRedactionFiles.has(relativePath)) continue;

    const source = readFileSync(file, "utf8");
    const labels = matchingPatternLabels(source);
    for (const label of labels) {
      findings.push(`${relativePath}: ${label}`);
    }
  }
}

if (findings.length) {
  throw new Error(`Potential secret exposure in runtime files:\n${findings.join("\n")}`);
}

console.log("✓ cookie/session secret detector regression");
console.log("✓ runtime secret exposure scan");
console.log("✓ no service-role/livekit/signing secrets in runtime code");
console.log("✓ secret exposure smoke test completed");
