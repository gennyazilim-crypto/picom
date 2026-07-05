import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse } from "./http.ts";

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

function normalizeAuthorizationHeader(value: string | null): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  return /^Bearer\s+\S+$/i.test(trimmed) ? trimmed : null;
}

export async function requireSupabaseUser(request: Request): Promise<SupabaseAuthResult> {
  const authorizationHeader = request.headers.get("Authorization");
  const authorization = normalizeAuthorizationHeader(authorizationHeader);

  if (!authorizationHeader) {
    return {
      ok: false,
      response: errorResponse("AUTH_REQUIRED", "Sign in before using this endpoint.", 401),
    };
  }

  if (!authorization) {
    return {
      ok: false,
      response: errorResponse("AUTH_INVALID", "Use a valid Bearer token for this endpoint.", 401),
    };
  }

  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const supabaseAnonKey = getRequiredEnv("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      response: errorResponse("SUPABASE_NOT_CONFIGURED", "Supabase auth is not configured for this function.", 503),
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
      response: errorResponse("AUTH_INVALID", "Your session could not be verified.", 401),
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
