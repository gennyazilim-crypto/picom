import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function requireEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  const value = import.meta.env[name]?.trim() ?? "";
  if (!value) {
    throw new Error(`Missing ${name}. Configure real Supabase credentials for the Account Center.`);
  }
  return value;
}

/**
 * Browser Supabase client for the Account Center SPA.
 * Uses PKCE and detects session from the URL (email/OAuth callbacks).
 */
export function createBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = requireEnv("VITE_SUPABASE_URL");
  const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "picom.account.auth",
    },
  });

  return browserClient;
}

export function getAccountSupabase(): SupabaseClient {
  return createBrowserClient();
}
