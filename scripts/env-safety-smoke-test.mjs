import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFiles = [".env.example", ".env.beta.example"];
const appConfigPath = resolve(root, "src/config/appConfig.ts");
const gitignorePath = resolve(root, ".gitignore");

const forbiddenEnvNames = [
  "SERVICE_ROLE",
  "SUPABASE_SERVICE_ROLE",
  "LIVEKIT_API_SECRET",
  "LIVEKIT_SECRET",
  "DATABASE_URL",
  "AUTH_SECRET",
  "JWT_SECRET",
  "PASSWORD",
  "COOKIE",
  "AUTHORIZATION",
  "SIGNING_KEY",
  "PRIVATE_KEY"
];

const allowedViteNames = new Set([
  "VITE_APP_ENV",
  "VITE_RELEASE_CHANNEL",
  "VITE_APP_NAME",
  "VITE_APP_IDENTIFIER",
  "VITE_DATA_SOURCE",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_LIVEKIT_URL",
  "VITE_DEV_SERVER_URL"
]);

const suspiciousValuePatterns = [
  /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
  /\bsk-[a-zA-Z0-9_-]{16,}\b/,
  /\bsb_secret_[a-zA-Z0-9_-]{12,}\b/,
  /\bservice_role\b/i,
  /\bpk_live_[a-zA-Z0-9_-]{12,}\b/
];

if (!existsSync(gitignorePath)) {
  throw new Error("Missing .gitignore.");
}

const gitignore = readFileSync(gitignorePath, "utf8");
for (const ignored of [".env", ".env.local"]) {
  if (!gitignore.split(/\r?\n/).includes(ignored)) {
    throw new Error(`Missing gitignore protection for ${ignored}.`);
  }
}

for (const file of envFiles) {
  const filePath = resolve(root, file);
  if (!existsSync(filePath)) {
    throw new Error(`Missing environment example: ${file}`);
  }

  const text = readFileSync(filePath, "utf8");

  for (const forbidden of forbiddenEnvNames) {
    const pattern = new RegExp(`^\\s*${forbidden}\\s*=`, "im");
    if (pattern.test(text)) {
      throw new Error(`${file} must not define server-only secret ${forbidden}.`);
    }
  }

  for (const pattern of suspiciousValuePatterns) {
    if (pattern.test(text)) {
      throw new Error(`${file} appears to contain a real secret-like value.`);
    }
  }

  const envNames = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=")[0]);

  for (const name of envNames) {
    if (!allowedViteNames.has(name)) {
      throw new Error(`${file} contains an undocumented renderer env variable: ${name}`);
    }
  }
}

const appConfig = readFileSync(appConfigPath, "utf8");
if (/import\.meta\.env\.(?!VITE_)[A-Z0-9_]+/.test(appConfig)) {
  throw new Error("Renderer app config must only read VITE_ environment variables.");
}

if (!appConfig.includes('runtimeTarget: "electron"')) {
  throw new Error("App config must keep Electron runtime target explicit.");
}

if (!readFileSync(resolve(root, ".env.example"), "utf8").includes("VITE_DATA_SOURCE=mock")) {
  throw new Error("Default .env.example must keep mock mode as the safe local default.");
}

console.log("✓ environment examples exist");
console.log("✓ server-only secrets are absent from renderer env examples");
console.log("✓ real .env files are ignored");
console.log("✓ renderer config only reads VITE_ variables");
console.log("✓ environment safety smoke test completed");
