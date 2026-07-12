import { chmodSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const run = process.argv.includes("--run");
const approvedProjectRef = "ufmtvqtsklqsmqxefbbs";
const evidencePath = resolve("artifacts/evidence/task-664-self-hosted-token-deployment.json");
const requiredNames = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
  "PICOM_LIVEKIT_STAGING_PROJECT_REF",
  "PICOM_SELF_HOSTED_LIVEKIT_CONFIG_FILE",
  "PICOM_SELF_HOSTED_NETWORK_FILE",
  "PICOM_ALLOWED_ORIGINS",
  "PICOM_SELF_HOSTED_TEST_ORIGIN",
  "PICOM_CONFIRM_SELF_HOSTED_TOKEN_DEPLOY",
  "PICOM_CONFIRM_SELF_HOSTED_MIGRATIONS",
];

const redact = (value) => String(value ?? "")
  .replace(/sbp_[A-Za-z0-9_-]+/g, "[REDACTED_SUPABASE_PAT]")
  .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[REDACTED_SUPABASE_KEY]")
  .replace(/eyJ[A-Za-z0-9._-]+/g, "[REDACTED_JWT]")
  .replace(/PIC[A-Fa-f0-9]{20,}/g, "[REDACTED_LIVEKIT_KEY]")
  .replace(/[A-Fa-f0-9]{48,}/g, "[REDACTED_SECRET]")
  .replace(/(?:https?|wss):\/\/[^\s"']+/g, "[REDACTED_ENDPOINT]")
  .slice(-900);

function parseEnvFile(path) {
  const values = new Map();
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index > 0) values.set(line.slice(0, index).trim(), line.slice(index + 1).trim());
  }
  return values;
}

function protectedExternalFile(value, label) {
  if (!value) throw new Error(`${label} path is missing.`);
  const path = realpathSync(value);
  const root = realpathSync(process.cwd());
  if (path === root || path.startsWith(`${root}${sep}`)) throw new Error(`${label} must stay outside the repository.`);
  if (process.platform !== "win32") {
    const mode = Number.parseInt((readFileSync ? (awaitImportMode(path)) : "0"), 8);
    if ((mode & 0o007) !== 0) throw new Error(`${label} must not be world-readable.`);
  }
  return path;
}

function awaitImportMode(path) {
  const result = spawnSync("stat", ["-c", "%a", path], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error("Protected file mode could not be verified.");
  return result.stdout.trim();
}

function command(executable, args, environment = process.env) {
  const result = spawnSync(executable, args, { cwd: process.cwd(), env: environment, encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`Protected command failed: ${redact(result.stderr || result.stdout || result.error?.message)}`);
}

if (!run) {
  console.log("Self-hosted LiveKit token staging deployment is BLOCKED until --run and protected STAGING_ONLY inputs are supplied.");
  console.log(`Required variable names: ${requiredNames.join(", ")}`);
  console.log("No network request was made and no value was printed.");
  process.exit(0);
}

const missing = requiredNames.filter((name) => !process.env[name]?.trim());
if (missing.length) throw new Error(`Missing protected configuration names: ${missing.join(", ")}`);
if (process.env.PICOM_CONFIRM_SELF_HOSTED_TOKEN_DEPLOY !== "STAGING_ONLY") throw new Error("Token deploy confirmation must equal STAGING_ONLY.");
if (process.env.PICOM_CONFIRM_SELF_HOSTED_MIGRATIONS !== "YES") throw new Error("Reviewed migration confirmation must equal YES.");
if (process.env.SUPABASE_PROJECT_REF !== approvedProjectRef || process.env.PICOM_LIVEKIT_STAGING_PROJECT_REF !== approvedProjectRef) throw new Error("Deployment is restricted to the approved Picom staging project.");
if (process.env.PICOM_SELF_HOSTED_TEST_ORIGIN !== process.env.PICOM_SELF_HOSTED_TEST_ORIGIN.trim()) throw new Error("Test origin is invalid.");

const configPath = protectedExternalFile(process.env.PICOM_SELF_HOSTED_LIVEKIT_CONFIG_FILE, "LiveKit config");
const networkPath = protectedExternalFile(process.env.PICOM_SELF_HOSTED_NETWORK_FILE, "Network config");
const config = readFileSync(configPath, "utf8");
const keyRows = [...config.matchAll(/^  "([^"]+)": "([^"]+)"$/gm)].map((match) => ({ key: match[1], secret: match[2] }));
if (keyRows.length !== 1 || keyRows[0].key.length < 16 || keyRows[0].secret.length < 32) throw new Error("Initial deployment requires exactly one valid active LiveKit key pair.");
const network = parseEnvFile(networkPath);
const hostname = network.get("PICOM_PRIMARY_HOSTNAME");
if (!hostname || !/^(?!.*\.invalid$)[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(hostname)) throw new Error("Protected primary hostname is invalid.");
const livekitUrl = `wss://${hostname}`;

const allowedOrigins = process.env.PICOM_ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
if (!allowedOrigins.length || allowedOrigins.includes("*")) throw new Error("Exact allowed origins are required.");
for (const origin of allowedOrigins) {
  const url = new URL(origin);
  const loopback = ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) throw new Error("Allowed origins must use HTTPS except explicit loopback development origins.");
}
if (!allowedOrigins.includes(process.env.PICOM_SELF_HOSTED_TEST_ORIGIN)) throw new Error("Hosted media test origin must be present in the exact allowlist.");

const workDir = join(tmpdir(), `picom-task-664-${process.pid}-${Date.now()}`);
mkdirSync(workDir, { recursive: true, mode: 0o700 });
const secretEnv = join(workDir, "supabase-secrets.env");
try {
  writeFileSync(secretEnv, [
    `LIVEKIT_URL=${livekitUrl}`,
    `LIVEKIT_API_KEY=${keyRows[0].key}`,
    `LIVEKIT_API_SECRET=${keyRows[0].secret}`,
    `PICOM_ALLOWED_ORIGINS=${allowedOrigins.join(",")}`,
    "PICOM_V1_VOICE_SCREEN_ENABLED=true",
    "",
  ].join("\n"), { encoding: "utf8", mode: 0o600 });
  chmodSync(secretEnv, 0o600);
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  command(npx, ["-y", "supabase@2.109.1", "secrets", "set", "--project-ref", approvedProjectRef, "--env-file", secretEnv]);
  command(process.execPath, ["scripts/deploy-livekit-token-staging.mjs", "--apply"], {
    ...process.env,
    PICOM_CONFIRM_LIVEKIT_EDGE_DEPLOY: "STAGING_ONLY",
    PICOM_CONFIRM_LIVEKIT_MIGRATIONS_APPLIED: "YES",
  });
  command(process.execPath, ["scripts/livekit-token-member-hosted-fixture.mjs"], {
    ...process.env,
    PICOM_CONFIRM_LIVEKIT_HOSTED_FIXTURE: "STAGING_ONLY",
  });
  command(process.execPath, ["scripts/hosted-member-voice-screen-e2e.mjs", "--run"], {
    ...process.env,
    PICOM_HOSTED_MEDIA_CONFIRM: "STAGING_ONLY",
    PICOM_HOSTED_MEDIA_PROJECT_REF: approvedProjectRef,
    PICOM_HOSTED_MEDIA_ORIGIN: process.env.PICOM_SELF_HOSTED_TEST_ORIGIN,
  });
  mkdirSync(resolve("artifacts/evidence"), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify({
    task: 664,
    status: "passed",
    provider: "self-hosted-livekit",
    environment: "staging",
    serverSecretsConfigured: true,
    hardenedFunctionDeployed: true,
    activeMemberTokenMatrixPassed: true,
    denialMatrixPassed: true,
    selfHostedWssMediaConnectionPassed: true,
    tokenOrSecretIncluded: false,
    recordedAt: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");
  console.log("Self-hosted staging token Function, active-member authorization matrix, and provider media connection passed; evidence is redacted.");
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
