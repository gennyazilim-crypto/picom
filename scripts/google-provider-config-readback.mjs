#!/usr/bin/env node
/**
 * Redacted local/runtime configuration audit for the Google callback path.
 * This intentionally never reads values into output and never calls provider APIs.
 * A hosted Supabase/Google Console setting remains UNVERIFIED without a privileged,
 * explicit production validation run.
 */
import { existsSync, readFileSync } from "node:fs";

const files = [
  ".env",
  ".env.local",
  ".env.production",
  "services/auth-gateway/.env",
  "supabase/functions/.env",
];

const configuredValues = new Map(
  Object.entries(process.env).filter(([, value]) => typeof value === "string" && value.trim()),
);
for (const file of files) {
  if (!existsSync(file)) continue;
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
    if (value) configuredValues.set(match[1], value);
  }
}

const hasAny = (...keys) => keys.some((key) => configuredValues.has(key));
const urlStatus = (keys, expected) => {
  const value = keys.map((key) => configuredValues.get(key)).find(Boolean);
  if (!value) return "MISSING";
  try {
    return new URL(value).toString().replace(/\/+$/, "") === expected ? "PRESENT" : "INVALID";
  } catch {
    return "INVALID";
  }
};

const output = {
  audit: "GOOGLE_PROVIDER_LOCAL_RUNTIME_READBACK",
  scope: "local-and-runtime-only",
  SUPABASE_URL: hasAny("VITE_SUPABASE_URL", "SUPABASE_URL") ? "PRESENT" : "MISSING",
  SUPABASE_ANON_KEY: hasAny("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY") ? "PRESENT" : "MISSING",
  GOOGLE_OAUTH_ENABLED_FLAG: hasAny("VITE_SUPABASE_GOOGLE_OAUTH_ENABLED") ? "PRESENT" : "MISSING",
  GOOGLE_CLIENT_ID: hasAny("GOOGLE_CLIENT_ID", "SUPABASE_GOOGLE_CLIENT_ID") ? "PRESENT" : "UNVERIFIED",
  GOOGLE_CLIENT_SECRET: hasAny("GOOGLE_CLIENT_SECRET", "SUPABASE_GOOGLE_CLIENT_SECRET") ? "PRESENT" : "UNVERIFIED",
  GOOGLE_REDIRECT_URI: urlStatus(["GOOGLE_REDIRECT_URI", "SUPABASE_GOOGLE_REDIRECT_URI"], "https://auth.picom.gg/google/callback"),
  AUTH_PICOM_GG: urlStatus(["VITE_AUTH_GATEWAY_URL", "AUTH_GATEWAY_PUBLIC_URL"], "https://auth.picom.gg"),
  TLS: "UNVERIFIED",
  SUPABASE_REDIRECT_ALLOWLIST: "UNVERIFIED",
};

console.log(JSON.stringify(output, null, 2));
