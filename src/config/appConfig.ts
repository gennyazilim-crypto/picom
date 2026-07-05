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

export const appConfig = Object.freeze({
  name: import.meta.env.VITE_APP_NAME ?? "Picom",
  identifier: import.meta.env.VITE_APP_IDENTIFIER ?? "com.picom.desktop",
  environment,
  releaseChannel: getReleaseChannel(import.meta.env.VITE_RELEASE_CHANNEL, environment),
  dataSource: getDataSourceMode(import.meta.env.VITE_DATA_SOURCE),
  runtimeTarget: "electron" as const,
  supportedPlatforms: ["windows", "linux", "macos"] as const,
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
