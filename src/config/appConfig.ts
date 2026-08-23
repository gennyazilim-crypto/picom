import { resolveReleaseChannel, type ReleaseChannel } from "./releaseChannel";
import { v1ReleaseScope } from "./v1ReleaseScope";
import { resolveDataSourceDecision, type DataSourceMode } from "./dataSourcePolicy";
import { accountCenterUrls } from "./accountCenterUrls";

export type { DataSourceMode } from "./dataSourcePolicy";
export type { ReleaseChannel } from "./releaseChannel";

function getBooleanFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function isBrowserRuntime(): boolean {
  return typeof window !== "undefined" && !window.picomDesktop;
}

const DEFAULT_PUBLIC_APP_URL = "https://account.picom.gg";

function resolvePublicAppUrl(): string {
  const configured = import.meta.env.VITE_APP_URL?.trim().replace(/\/+$/, "");
  if (!configured) return DEFAULT_PUBLIC_APP_URL;

  try {
    const url = new URL(configured);
    if (url.protocol === "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return configured;
    }
  } catch {
    // Invalid or local values must never be embedded in production auth email links.
  }

  return DEFAULT_PUBLIC_APP_URL;
}

/** Auth emails always start on the public HTTPS bridge, never a local development origin. */
function resolveAuthRedirect(envValue: string | undefined, desktopDefault: string, browserPath: string): string {
  const configured = envValue?.trim();
  if (isBrowserRuntime()) {
    if (configured?.startsWith("https://")) {
      try {
        const url = new URL(configured);
        if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return configured;
      } catch {
        // Fall through to the canonical public bridge.
      }
    }
    return `${resolvePublicAppUrl()}${browserPath}`;
  }
  return configured || desktopDefault;
}

const environment = import.meta.env.VITE_APP_ENV ?? "development";
const gitCommit = import.meta.env.VITE_GIT_COMMIT ?? "local";
const appVersion = import.meta.env.VITE_APP_VERSION ?? v1ReleaseScope.version;
const releaseChannel = resolveReleaseChannel(import.meta.env.VITE_RELEASE_CHANNEL, environment, appVersion) satisfies ReleaseChannel;
const dataSourceDecision = resolveDataSourceDecision(import.meta.env.VITE_DATA_SOURCE, { environment, releaseChannel });

export const appConfig = Object.freeze({
  features: Object.freeze({
    companionMode: import.meta.env.VITE_COMPANION_MODE_ENABLED !== "false",
  }),
  name: import.meta.env.VITE_APP_NAME ?? "Picom",
  version: appVersion,
  identifier: import.meta.env.VITE_APP_IDENTIFIER ?? "com.picom.desktop",
  environment,
  releaseChannel,
  dataSource: dataSourceDecision.mode satisfies DataSourceMode,
  dataSourceExplicit: dataSourceDecision.explicit,
  dataSourceConfigurationError: dataSourceDecision.reason,
  statusPageUrl: import.meta.env.VITE_STATUS_PAGE_URL ?? "",
  remoteConfigUrl: import.meta.env.VITE_REMOTE_CONFIG_URL ?? "",
  realtimeScalingMode: import.meta.env.VITE_REALTIME_SCALING_MODE ?? "supabase_managed",
  runtimeTarget: "electron" as const,
  releaseScope: v1ReleaseScope.releaseId,
  supportedPlatforms: v1ReleaseScope.supportedPlatforms,
  build: Object.freeze({
    date: import.meta.env.VITE_BUILD_DATE ?? "development",
    commit: gitCommit,
    commitShort: gitCommit === "local" ? "local" : gitCommit.slice(0, 12),
    desktopRuntime: "electron",
    frontendBuildHash: import.meta.env.VITE_FRONTEND_BUILD_HASH ?? "development",
    backendApiCompatibilityVersion: import.meta.env.VITE_API_COMPATIBILITY_VERSION ?? "mvp-placeholder"
  }),
  /** Branded auth gateway — Steam OpenID realm/start. Never a supabase.co host. */
  authGatewayUrl: (() => {
    const configured = import.meta.env.VITE_AUTH_GATEWAY_URL?.trim().replace(/\/+$/, "");
    if (configured) {
      try {
        const url = new URL(configured);
        if (url.protocol === "https:" && url.hostname === "auth.picom.gg") return configured;
      } catch {
        // fall through
      }
    }
    return "https://auth.picom.gg";
  })(),
  supabase: Object.freeze({
    url: import.meta.env.VITE_SUPABASE_URL ?? "",
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
    oauthRedirectUrl: resolveAuthRedirect(import.meta.env.VITE_SUPABASE_OAUTH_REDIRECT_URL, "picom://auth/callback", "/auth/callback"),
    passwordResetRedirectUrl: accountCenterUrls.resetPassword,
    emailVerificationRedirectUrl: accountCenterUrls.confirmEmail,
    requireEmailVerification: getBooleanFlag(import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION),
    googleOAuthEnabled: getBooleanFlag(import.meta.env.VITE_SUPABASE_GOOGLE_OAUTH_ENABLED),
    appleOAuthEnabled: getBooleanFlag(import.meta.env.VITE_SUPABASE_APPLE_OAUTH_ENABLED),
    steamOAuthEnabled: getBooleanFlag(import.meta.env.VITE_SUPABASE_STEAM_OAUTH_ENABLED),
    epicOAuthEnabled: getBooleanFlag(import.meta.env.VITE_SUPABASE_EPIC_OAUTH_ENABLED)
  }),
  liveKit: Object.freeze({
    enabled: getBooleanFlag(import.meta.env.VITE_LIVEKIT_ENABLED),
    url: import.meta.env.VITE_LIVEKIT_URL ?? ""
  })
});

export const isSupabaseMode = appConfig.dataSource === "supabase";
export function isBrowserAppRuntime(): boolean {
  return isBrowserRuntime();
}
