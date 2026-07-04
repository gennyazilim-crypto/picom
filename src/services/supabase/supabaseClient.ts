import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dataSourceService } from "../dataSourceService";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null = null;

export type SupabaseClientStatus = {
  enabled: boolean;
  configured: boolean;
  reason?: string;
};

export function getSupabaseClientStatus(): SupabaseClientStatus {
  const status = dataSourceService.getStatus();

  if (!status.isSupabase) {
    return { enabled: false, configured: false, reason: "VITE_DATA_SOURCE is not supabase." };
  }

  if (!status.configured) {
    return { enabled: true, configured: false, reason: status.reason };
  }

  return { enabled: true, configured: true };
}

export function getSupabaseClient(): SupabaseClient<Database> | null {
  const status = getSupabaseClientStatus();
  if (!status.configured) return null;
  if (client) return client;

  const supabaseConfig = dataSourceService.getSupabaseConfig();

  client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
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