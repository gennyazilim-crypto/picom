import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "./http.ts";

type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type SupabaseAuthResult =
  | {
      ok: true;
      user: SupabaseUser;
      supabase: ReturnType<typeof createClient>;
    }
  | {
      ok: false;
      response: Response;
    };

function getRequiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim().length > 0 ? value : null;
}

export async function requireSupabaseUser(request: Request): Promise<SupabaseAuthResult> {
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return {
      ok: false,
      response: jsonResponse({ code: "AUTH_REQUIRED", message: "Sign in before using this endpoint." }, { status: 401 }),
    };
  }

  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const supabaseAnonKey = getRequiredEnv("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      response: jsonResponse({ code: "SUPABASE_NOT_CONFIGURED", message: "Supabase auth is not configured for this function." }, { status: 503 }),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: jsonResponse({ code: "AUTH_INVALID", message: "Your session could not be verified." }, { status: 401 }),
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    },
    supabase,
  };
}
