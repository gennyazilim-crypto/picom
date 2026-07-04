import { appConfig, type DataSourceMode } from "../config/appConfig";

export type DataSourceStatus = Readonly<{
  mode: DataSourceMode;
  label: "Mock" | "Supabase";
  isMock: boolean;
  isSupabase: boolean;
  configured: boolean;
  reason?: string;
}>;

function getSupabaseConfiguredReason(): string | undefined {
  if (!appConfig.supabase.url || !appConfig.supabase.anonKey) {
    return "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.";
  }

  return undefined;
}

export const dataSourceService = {
  getMode(): DataSourceMode {
    return appConfig.dataSource;
  },

  getStatus(): DataSourceStatus {
    if (appConfig.dataSource === "mock") {
      return {
        mode: "mock",
        label: "Mock",
        isMock: true,
        isSupabase: false,
        configured: true,
      };
    }

    const reason = getSupabaseConfiguredReason();

    return {
      mode: "supabase",
      label: "Supabase",
      isMock: false,
      isSupabase: true,
      configured: !reason,
      reason,
    };
  },

  getSupabaseConfig() {
    return appConfig.supabase;
  },
};