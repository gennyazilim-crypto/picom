import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { appConfig, isSupabaseMode } from "../../config/appConfig";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null = null;

export type SupabaseClientStatus = {
  enabled: boolean;
  configured: boolean;
  reason?: string;
};

export function getSupabaseClientStatus(): SupabaseClientStatus {
  if (!isSupabaseMode) {
    return { enabled: false, configured: false, reason: "VITE_DATA_SOURCE is not supabase." };
  }

  if (!appConfig.supabase.url || !appConfig.supabase.anonKey) {
    return { enabled: true, configured: false, reason: "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY." };
  }

  return { enabled: true, configured: true };
}

export function getSupabaseClient(): SupabaseClient<Database> | null {
  const status = getSupabaseClientStatus();
  if (!status.configured) return null;
  if (client) return client;

  client = createClient(appConfig.supabase.url, appConfig.supabase.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return client;
}
