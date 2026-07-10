import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const requestedTarget = option("--target");
const requestedFile = option("--file");

const targets = {
  local: { file: ".env.example", appEnv: "development", release: "dev", dataSource: "mock" },
  staging: { file: ".env.beta.example", appEnv: "beta", release: "beta", dataSource: "supabase" },
  production: { file: ".env.production.example", appEnv: "production", release: "stable", dataSource: "supabase" },
};

const forbiddenRendererName = /VITE_.*(?:SERVICE_ROLE|ACCESS_TOKEN|API_SECRET|DATABASE_URL|PASSWORD|SIGNING|PRIVATE_KEY|JWT_SECRET|OAUTH.*SECRET)/i;
const rendererSafeRedirectNames = new Set([
  "VITE_SUPABASE_PASSWORD_RESET_REDIRECT_URL",
  "VITE_SUPABASE_EMAIL_VERIFICATION_REDIRECT_URL",
  "VITE_SUPABASE_OAUTH_REDIRECT_URL",
]);
const secretLikeValue = /(?:sb_secret_[A-Za-z0-9_-]{8,}|service[_-]?role|-----BEGIN [A-Z ]+PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@)/i;
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cts", ".mts"]);

function parseEnv(filePath) {
  if (!existsSync(filePath)) throw new Error(`Missing environment file: ${relative(root, filePath)}`);
  const entries = new Map();
  const text = readFileSync(filePath, "utf8");
  for (const [lineIndex, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error(`${relative(root, filePath)}:${lineIndex + 1} is not NAME=value.`);
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (entries.has(name)) throw new Error(`${relative(root, filePath)} defines ${name} more than once.`);
    entries.set(name, value);
  }
  return { entries, text };
}

function isPlaceholder(value) {
  return !value || /^(?:YOUR_|replace-with-|https?:\/\/YOUR_|wss?:\/\/YOUR_)/i.test(value);
}

function validatePublicUrl(value, target, example) {
  if (example && isPlaceholder(value)) return;
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${target}: VITE_SUPABASE_URL is invalid.`); }
  const localHttp = target === "local" && parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localHttp) throw new Error(`${target}: Supabase URL must use HTTPS outside local development.`);
  if (parsed.username || parsed.password) throw new Error(`${target}: Supabase URL must not contain credentials.`);
}

function validateTarget(target, configuredFile) {
  const policy = targets[target];
  if (!policy) throw new Error(`Unknown target ${target}. Use local, staging, or production.`);
  const filePath = resolve(root, configuredFile ?? policy.file);
  const { entries, text } = parseEnv(filePath);
  const example = filePath.endsWith(".example");

  for (const [name, value] of entries) {
    if (name.startsWith("VITE_") && forbiddenRendererName.test(name) && !rendererSafeRedirectNames.has(name)) {
      throw new Error(`${target}: renderer variable ${name} is server-only.`);
    }
    if (example && value && secretLikeValue.test(value)) {
      throw new Error(`${target}: ${name} contains a secret-like example value.`);
    }
  }

  for (const [name, expected] of [["VITE_APP_ENV", policy.appEnv], ["VITE_RELEASE_CHANNEL", policy.release], ["VITE_DATA_SOURCE", policy.dataSource]]) {
    if (entries.get(name) !== expected) throw new Error(`${target}: ${name} must be ${expected}.`);
  }

  if (policy.dataSource === "supabase") {
    for (const name of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]) {
      const value = entries.get(name);
      if (!value) throw new Error(`${target}: missing required ${name}.`);
      if (!example && isPlaceholder(value)) throw new Error(`${target}: ${name} still contains a placeholder.`);
    }
    validatePublicUrl(entries.get("VITE_SUPABASE_URL"), target, example);
    if (/service[_-]?role|sb_secret_/i.test(entries.get("VITE_SUPABASE_ANON_KEY"))) {
      throw new Error(`${target}: VITE_SUPABASE_ANON_KEY is not an anon/public key.`);
    }
  }

  if (/^\s*VITE_SUPABASE_SERVICE_ROLE/m.test(text)) throw new Error(`${target}: service-role key is exposed to Vite.`);
  console.log(`OK ${target} environment contract (${relative(root, filePath)})`);
}

function walk(directory, output = []) {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) walk(path, output);
    else if (sourceExtensions.has(extname(path))) output.push(path);
  }
  return output;
}

function validateRuntimeBoundary() {
  for (const directory of [resolve(root, "src"), resolve(root, "electron")]) {
    for (const file of walk(directory)) {
      const source = readFileSync(file, "utf8");
      if (/SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_SERVICE_ROLE/i.test(source)) {
        throw new Error(`Service-role key reference crossed into runtime source: ${relative(root, file)}`);
      }
    }
  }

  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  const unsafeEnv = tracked.filter((file) => /(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith(".example"));
  if (unsafeEnv.length) throw new Error(`Tracked non-example env files: ${unsafeEnv.join(", ")}`);

  const edgeExample = readFileSync(resolve(root, "supabase/functions/.env.example"), "utf8");
  if (!/^SUPABASE_SERVICE_ROLE_KEY=$/m.test(edgeExample)) {
    throw new Error("Edge Function env example must document an empty service-role placeholder.");
  }
  console.log("OK renderer contains public Supabase configuration only");
  console.log("OK service-role boundary is Edge/server-side only");
  console.log("OK no real environment file is tracked");
}

if (requestedFile && !requestedTarget) throw new Error("--file requires --target.");
for (const target of requestedTarget ? [requestedTarget] : Object.keys(targets)) validateTarget(target, requestedFile);
validateRuntimeBoundary();
console.log("Supabase environment validation passed.");
