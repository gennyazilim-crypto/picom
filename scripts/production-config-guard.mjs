/**
 * Fail-closed production config guard.
 * Blocks production builds/deploys that target known staging Supabase refs
 * or missing/placeholder production infrastructure.
 *
 * Usage:
 *   node scripts/production-config-guard.mjs
 *   node scripts/production-config-guard.mjs --strict-env-file=.env.production
 *
 * Does not print secret values — only variable names and classification codes.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FORBIDDEN_STAGING_REFS = Object.freeze([
  "ufmtvqtsklqsmqxefbbs",
  "kbdotviopwlcqviggtrc",
]);

const PLACEHOLDER_PATTERNS = [
  /YOUR_PRODUCTION/i,
  /CHANGE_ME/i,
  /placeholder/i,
  /example\.supabase\.co/i,
];

function parseArgs(argv) {
  let envFile = null;
  let requireProductionMode = true;
  for (const arg of argv) {
    if (arg.startsWith("--strict-env-file=")) envFile = arg.slice("--strict-env-file=".length);
    if (arg === "--allow-non-production-mode") requireProductionMode = false;
  }
  return { envFile, requireProductionMode };
}

function loadEnvFile(filePath) {
  if (!filePath) return {};
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  if (!fs.existsSync(absolute)) {
    return { __missing_file: absolute };
  }
  const out = {};
  for (const line of fs.readFileSync(absolute, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function classifyUrl(value) {
  if (!value || !String(value).trim()) return "MISSING";
  const v = String(value).trim();
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(v))) return "PLACEHOLDER";
  for (const ref of FORBIDDEN_STAGING_REFS) {
    if (v.includes(ref)) return `STAGING_REF:${ref}`;
  }
  return "OK";
}

function main() {
  const { envFile, requireProductionMode } = parseArgs(process.argv.slice(2));
  const mode = String(process.env.VITE_APP_ENV || process.env.MODE || process.env.NODE_ENV || "").toLowerCase();
  const fileEnv = loadEnvFile(envFile);
  if (fileEnv.__missing_file) {
    console.error("PICOM_PRODUCTION_CONFIG_GUARD=FAIL");
    console.error("CODE=PRODUCTION_ENV_FILE_MISSING");
    console.error(`FILE=${path.relative(root, fileEnv.__missing_file)}`);
    process.exit(1);
  }

  const merged = { ...fileEnv, ...process.env };
  const errors = [];

  if (requireProductionMode && mode && mode !== "production") {
    // When explicitly invoked as production guard with a production env file, mode must be production.
    if (envFile || String(process.env.PICOM_FORCE_PRODUCTION_GUARD || "") === "1") {
      errors.push("PRODUCTION_CONFIG_INVALID_ENVIRONMENT_NAME");
    }
  }

  if (envFile || String(process.env.PICOM_FORCE_PRODUCTION_GUARD || "") === "1" || mode === "production") {
    const appEnv = String(merged.VITE_APP_ENV || "").trim().toLowerCase();
    if (appEnv && appEnv !== "production") {
      errors.push("PRODUCTION_CONFIG_INVALID_ENVIRONMENT_NAME");
    }

    const urlClass = classifyUrl(merged.VITE_SUPABASE_URL || merged.SUPABASE_URL || "");
    if (urlClass === "MISSING") errors.push("PRODUCTION_CONFIG_MISSING_SUPABASE_URL");
    if (urlClass === "PLACEHOLDER") errors.push("PRODUCTION_CONFIG_PLACEHOLDER_SUPABASE_URL");
    if (urlClass.startsWith("STAGING_REF:")) errors.push("PRODUCTION_CONFIG_INVALID_STAGING_TARGET");

    const ref = String(merged.SUPABASE_PROJECT_REF || merged.VITE_SUPABASE_PROJECT_REF || "").trim();
    if (ref) {
      if (PLACEHOLDER_PATTERNS.some((re) => re.test(ref))) {
        errors.push("PRODUCTION_CONFIG_PLACEHOLDER_PROJECT_REF");
      }
      if (FORBIDDEN_STAGING_REFS.includes(ref)) {
        errors.push("PRODUCTION_CONFIG_INVALID_STAGING_TARGET");
      }
    }

    const livekitUrl = String(merged.VITE_LIVEKIT_URL || merged.LIVEKIT_URL || "");
    if (livekitUrl && FORBIDDEN_STAGING_REFS.some((r) => livekitUrl.includes(r))) {
      errors.push("PRODUCTION_CONFIG_INVALID_STAGING_TARGET");
    }
    if (String(merged.PICOM_LIVEKIT_ENV || "").toLowerCase() === "staging" && mode === "production") {
      errors.push("PRODUCTION_CONFIG_LIVEKIT_MARKED_STAGING");
    }
    if (String(merged.PICOM_WORKER_ENV || "").toLowerCase() === "staging" && mode === "production") {
      errors.push("PRODUCTION_CONFIG_WORKER_MARKED_STAGING");
    }
  } else {
    console.log("PICOM_PRODUCTION_CONFIG_GUARD=SKIP");
    console.log("REASON=non_production_mode");
    process.exit(0);
  }

  if (errors.length) {
    console.error("PICOM_PRODUCTION_CONFIG_GUARD=FAIL");
    for (const code of [...new Set(errors)]) {
      console.error(`CODE=${code}`);
    }
    process.exit(1);
  }

  console.log("PICOM_PRODUCTION_CONFIG_GUARD=PASS");
  process.exit(0);
}

main();
