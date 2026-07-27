/**
 * Parks / consumes one-time Account Center → product session handoffs.
 *
 * POST { nonce } + Authorization: Bearer <user access token>
 *   → stores access_token + refresh_token for that nonce (5 min, single-use)
 *
 * GET ?action=poll&nonce=…
 *   → atomically consumes and returns session once (anon + apikey)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NONCE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function corsHeaders(origin: string | null): HeadersInit {
  const allow = (Deno.env.get("PICOM_ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const defaults = [
    "https://account.picom.gg",
    "https://app.picom.gg",
    "https://picom.gg",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ];
  const allowed = allow.length ? allow : defaults;
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
  };
  if (origin && allowed.includes(origin)) {
    base["Access-Control-Allow-Origin"] = origin;
    base.Vary = "Origin";
  }
  return base;
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const client = getServiceClient();
  if (!client) {
    return json(503, { code: "NOT_CONFIGURED", message: "Session continue is not configured." }, origin);
  }

  const url = new URL(request.url);

  if (request.method === "GET" && url.searchParams.get("action") === "poll") {
    const nonce = url.searchParams.get("nonce") ?? "";
    if (!NONCE_PATTERN.test(nonce)) {
      return json(400, { status: "unknown", session: null }, origin);
    }
    const { data, error } = await client.rpc("consume_account_session_handoff", { target_nonce: nonce });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) {
      return json(200, { status: "unknown", session: null }, origin);
    }
    return json(200, {
      status: row.result_status ?? "unknown",
      session: row.result_status === "ready" ? row.result_session ?? null : null,
    }, origin);
  }

  if (request.method === "POST") {
    const authHeader = request.headers.get("Authorization") ?? "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken || accessToken.length < 20) {
      return json(401, { code: "AUTH_REQUIRED", message: "Sign in required." }, origin);
    }

    let body: { nonce?: string; refresh_token?: string } = {};
    try {
      body = await request.json();
    } catch {
      return json(400, { code: "INVALID_BODY", message: "Invalid JSON body." }, origin);
    }

    const nonce = typeof body.nonce === "string" ? body.nonce : "";
    const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : "";
    if (!NONCE_PATTERN.test(nonce) || !refreshToken || refreshToken.length < 20) {
      return json(400, { code: "INVALID_HANDOFF", message: "Invalid handoff payload." }, origin);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      },
    );
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user?.id) {
      return json(401, { code: "AUTH_INVALID", message: "Session is not valid." }, origin);
    }

    await client.from("account_session_handoffs").delete().lte("expires_at", new Date().toISOString());
    await client.from("account_session_handoffs").delete().eq("nonce", nonce);

    const { error: insertError } = await client.from("account_session_handoffs").insert({
      nonce,
      status: "ready",
      user_id: userData.user.id,
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
    });
    if (insertError) {
      return json(500, { code: "HANDOFF_STORE_FAILED", message: "Could not park session handoff." }, origin);
    }

    return json(200, { ok: true, nonce }, origin);
  }

  return json(405, { code: "METHOD_NOT_ALLOWED", message: "Use POST or GET poll." }, origin);
});
