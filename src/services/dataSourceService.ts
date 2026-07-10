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
  if (!appConfig.supabase.url) return "Missing VITE_SUPABASE_URL.";
  if (!appConfig.supabase.anonKey) return "Missing VITE_SUPABASE_ANON_KEY.";

  try {
    const url = new URL(appConfig.supabase.url);
    const isLocalHttp = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
    if (url.protocol !== "https:" && !isLocalHttp) {
      return "VITE_SUPABASE_URL must use HTTPS, except for local Supabase.";
    }
    if (url.username || url.password) return "VITE_SUPABASE_URL must not contain credentials.";
  } catch {
    return "VITE_SUPABASE_URL is not a valid URL.";
  }

  if (/service[_-]?role|sb_secret_/i.test(appConfig.supabase.anonKey)) {
    return "VITE_SUPABASE_ANON_KEY must be an anon or publishable key, never a service-role secret.";
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
