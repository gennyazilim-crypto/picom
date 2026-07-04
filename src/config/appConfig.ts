export type DataSourceMode = "mock" | "supabase";

function getDataSourceMode(value: string | undefined): DataSourceMode {
  return value === "supabase" ? "supabase" : "mock";
}

export const appConfig = Object.freeze({
  name: import.meta.env.VITE_APP_NAME ?? "Picom",
  identifier: import.meta.env.VITE_APP_IDENTIFIER ?? "com.picom.desktop",
  environment: import.meta.env.VITE_APP_ENV ?? "development",
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
