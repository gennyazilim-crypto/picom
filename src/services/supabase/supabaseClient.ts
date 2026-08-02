import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { dataSourceService } from "../dataSourceService";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | null = null;
/** Account Center (and other SPAs) bind their own auth client so profile media shares that session. */
let boundClient: SupabaseClient<Database> | null = null;

const AUTH_REMEMBER_FLAG_KEY = "picom.auth.rememberMe";

/**
 * Prefer this SPA's Supabase client for profile media / shared services.
 * Pass null to clear (desktop/main app uses the default singleton again).
 */
export function bindSupabaseClient(next: SupabaseClient<Database> | SupabaseClient | null): void {
  boundClient = next as SupabaseClient<Database> | null;
}

/**
 * Records the user's "remember me" preference. Supabase persists the session in
 * localStorage by default, so the user stays signed in across restarts until an
 * explicit sign-out. When "remember me" is off we clear the persisted session on
 * the next sign-out request. The raw password is never stored.
 */
export function setAuthRememberMe(remember: boolean): void {
  try {
    localStorage.setItem(AUTH_REMEMBER_FLAG_KEY, remember ? "true" : "false");
  } catch {
    // Storage unavailable (private mode) — falls back to the default persistent session.
  }
}

export type SupabaseClientStatus = {
  enabled: boolean;
  configured: boolean;
  reason?: string;
};

export function getSupabaseClientStatus(): SupabaseClientStatus {
  if (boundClient) {
    return { enabled: true, configured: true };
  }

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
  if (boundClient) return boundClient;

  const status = getSupabaseClientStatus();
  if (!status.configured) return null;
  if (client) return client;

  const supabaseConfig = dataSourceService.getSupabaseConfig();

  client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // PKCE codes are exchanged via deepLinkService (picom:// and /auth/* browser paths).
      detectSessionInUrl: false,
      flowType: "pkce",
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  const configuredClient = client;
  configuredClient.auth.onAuthStateChange((event, session) => {
    if (session?.access_token && (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED")) {
      void configuredClient.realtime.setAuth(session.access_token);
    }
    if (event === "SIGNED_OUT") void configuredClient.removeAllChannels();
  });

  return client;
}
