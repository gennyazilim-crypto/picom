import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), geolocation=(), payment=(), usb=()",
};

function safeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return ["https:", "wss:"].includes(parsed.protocol) ? parsed.origin : null;
  } catch {
    return null;
  }
}

/** Local Supabase (and similar) serve storage over http://127.0.0.1 / localhost. */
function localHttpOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:") return null;
    if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function realtimeOrigin(value: string | undefined): string | null {
  const origin = safeOrigin(value) ?? localHttpOrigin(value);
  if (!origin) return null;
  const parsed = new URL(origin);
  if (parsed.protocol === "https:") parsed.protocol = "wss:";
  if (parsed.protocol === "http:") parsed.protocol = "ws:";
  return parsed.origin;
}

function httpOrigin(value: string | undefined): string | null {
  const origin = safeOrigin(value);
  if (!origin) return null;
  const parsed = new URL(origin);
  if (parsed.protocol === "wss:") parsed.protocol = "https:";
  return parsed.origin;
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function createProductionCsp(env: Record<string, string>): string {
  const supabaseOrigin = safeOrigin(env.VITE_SUPABASE_URL) ?? localHttpOrigin(env.VITE_SUPABASE_URL);
  const connectOrigins = unique([
    supabaseOrigin,
    realtimeOrigin(env.VITE_SUPABASE_URL),
    localHttpOrigin(env.VITE_SUPABASE_URL),
    httpOrigin(env.VITE_LIVEKIT_URL),
    safeOrigin(env.VITE_LIVEKIT_URL),
    realtimeOrigin(env.VITE_LIVEKIT_URL),
    safeOrigin(env.VITE_REMOTE_CONFIG_URL),
    safeOrigin(env.VITE_STATUS_PAGE_URL),
  ]);
  const storageOrigins = unique([supabaseOrigin, localHttpOrigin(env.VITE_SUPABASE_URL)]);
  // Google Ads is opt-in at runtime and enabled only when a real public Ads ID is
  // present at build time. Keep the CSP origin list exact; do not use wildcards.
  const googleAdsEnabled = /^AW-\d{6,20}$/.test(env.VITE_GOOGLE_ADS_ID ?? "")
    && /^[A-Za-z0-9_-]{1,128}$/.test(env.VITE_GOOGLE_ADS_REGISTRATION_COMPLETED_CONVERSION_LABEL ?? "");
  const googleAdsScriptOrigins = googleAdsEnabled ? ["https://www.googletagmanager.com"] : [];
  const googleAdsNetworkOrigins = googleAdsEnabled
    ? [
      "https://www.googletagmanager.com",
      "https://www.google.com",
      "https://www.googleadservices.com",
      "https://pagead2.googlesyndication.com",
    ]
    : [];
  const directives = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    `script-src 'self'${googleAdsScriptOrigins.length ? ` ${googleAdsScriptOrigins.join(" ")}` : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${storageOrigins.length ? ` ${storageOrigins.join(" ")}` : ""}${googleAdsNetworkOrigins.length ? ` ${googleAdsNetworkOrigins.join(" ")}` : ""}`,
    "font-src 'self' data:",
    `connect-src 'self'${connectOrigins.length ? ` ${connectOrigins.join(" ")}` : ""}${googleAdsNetworkOrigins.length ? ` ${googleAdsNetworkOrigins.join(" ")}` : ""}`,
    `media-src 'self' blob:${storageOrigins.length ? ` ${storageOrigins.join(" ")}` : ""}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'none'",
  ];
  if (supabaseOrigin?.startsWith("https://")) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

export function createDevelopmentCsp(env: Record<string, string>): string {
  // Dev: allow local Supabase storage + any https brand asset while iterating.
  return createProductionCsp(env)
    .replace("script-src 'self'", "script-src 'self' 'unsafe-eval' http://127.0.0.1:5173")
    .replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:5173 ws://127.0.0.1:5173 http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*")
    .replace(/img-src 'self' data: blob:[^;]*/, "img-src 'self' data: blob: https: http://127.0.0.1:* http://localhost:*")
    .replace(/media-src 'self' blob:[^;]*/, "media-src 'self' blob: https: http://127.0.0.1:* http://localhost:*")
    .replace("; upgrade-insecure-requests", "");
}

function cspPlugin(content: string): Plugin {
  return {
    name: "picom-content-security-policy",
    transformIndexHtml: {
      order: "pre",
      handler: () => [{
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content },
        injectTo: "head-prepend",
      }],
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const csp = command === "serve" ? createDevelopmentCsp(env) : createProductionCsp(env);
  return {
    base: "./",
    plugins: [cspPlugin(csp), react()],
    build: { manifest: true, cssCodeSplit: true, target: "chrome150" },
    server: { host: "127.0.0.1", port: 5173, strictPort: true, headers: SECURITY_HEADERS },
    preview: { host: "127.0.0.1", headers: SECURITY_HEADERS },
  };
});
