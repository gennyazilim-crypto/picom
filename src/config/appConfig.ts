export type DataSourceMode = "mock" | "supabase";
export type ReleaseChannel = "dev" | "beta" | "stable";

function getDataSourceMode(value: string | undefined): DataSourceMode {
  return value === "supabase" ? "supabase" : "mock";
}

function getReleaseChannel(value: string | undefined, environment: string): ReleaseChannel {
  if (value === "beta" || value === "stable" || value === "dev") {
    return value;
  }

  return environment === "beta" ? "beta" : "dev";
}

const environment = import.meta.env.VITE_APP_ENV ?? "development";
const gitCommit = import.meta.env.VITE_GIT_COMMIT ?? "local";

export const appConfig = Object.freeze({
  name: import.meta.env.VITE_APP_NAME ?? "Picom",
  version: import.meta.env.VITE_APP_VERSION ?? "0.1.0",
  identifier: import.meta.env.VITE_APP_IDENTIFIER ?? "com.picom.desktop",
  environment,
  releaseChannel: getReleaseChannel(import.meta.env.VITE_RELEASE_CHANNEL, environment),
  dataSource: getDataSourceMode(import.meta.env.VITE_DATA_SOURCE),
  statusPageUrl: import.meta.env.VITE_STATUS_PAGE_URL ?? "",
  remoteConfigUrl: import.meta.env.VITE_REMOTE_CONFIG_URL ?? "",
  realtimeScalingMode: import.meta.env.VITE_REALTIME_SCALING_MODE ?? "supabase_managed",
  runtimeTarget: "electron" as const,
  supportedPlatforms: ["windows", "linux", "macos"] as const,
  build: Object.freeze({
    date: import.meta.env.VITE_BUILD_DATE ?? "development",
    commit: gitCommit,
    commitShort: gitCommit === "local" ? "local" : gitCommit.slice(0, 12),
    desktopRuntime: "electron",
    frontendBuildHash: import.meta.env.VITE_FRONTEND_BUILD_HASH ?? "development",
    backendApiCompatibilityVersion: import.meta.env.VITE_API_COMPATIBILITY_VERSION ?? "mvp-placeholder"
  }),
  supabase: Object.freeze({
    url: import.meta.env.VITE_SUPABASE_URL ?? "",
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""
  }),
  liveKit: Object.freeze({
    url: import.meta.env.VITE_LIVEKIT_URL ?? ""
  })
});

export const isMockMode = appConfig.dataSource === "mock";
export const isSupabaseMode = appConfig.dataSource === "supabase";
