import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared helpers for the custom social sign-in Edge Functions (steam-auth, epic-auth).
// These mint a real Supabase session for an externally-verified identity using the
// service-role key, then park it in public.social_auth_handoffs for the initiating
// client to poll. SECURITY REVIEW REQUIRED before deploy/enable.

export type SocialSessionTokens = Readonly<{ access_token: string; refresh_token: string }>;

export function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

// A random URL-safe nonce validator (client-generated, 32+ chars).
export function isValidNonce(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

type ServiceClient = NonNullable<ReturnType<typeof getServiceClient>>;

// Find or create the Supabase user for a synthetic/external identity, then mint a
// session by generating a magic link and completing the verify step server-side.
export async function mintSessionForIdentity(
  client: ServiceClient,
  identity: Readonly<{ email: string; metadata: Record<string, unknown> }>,
): Promise<SocialSessionTokens | null> {
  // Create the user if it does not exist yet (idempotent: ignore "already registered").
  const created = await client.auth.admin.createUser({
    email: identity.email,
    email_confirm: true,
    user_metadata: identity.metadata,
  });
  if (created.error && !/already|exist|registered/i.test(created.error.message)) {
    return null;
  }

  const linked = await client.auth.admin.generateLink({ type: "magiclink", email: identity.email });
  if (linked.error || !linked.data?.properties?.action_link) return null;

  // Complete the verify step server-side (no browser). The 303 redirect carries the
  // session in the URL fragment; we read it from the Location header.
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const verifyResponse = await fetch(linked.data.properties.action_link, {
    method: "GET",
    redirect: "manual",
    headers: anonKey ? { apikey: anonKey } : {},
  });
  const location = verifyResponse.headers.get("location");
  if (!location) return null;

  const fragment = location.includes("#") ? location.slice(location.indexOf("#") + 1) : "";
  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  return { access_token: accessToken, refresh_token: refreshToken };
}

export async function createPendingHandoff(client: ServiceClient, nonce: string, provider: "steam" | "epic"): Promise<boolean> {
  const { error } = await client.from("social_auth_handoffs").insert({ nonce, provider, status: "pending" });
  return !error;
}

export async function completeHandoff(client: ServiceClient, nonce: string, provider: "steam" | "epic", session: SocialSessionTokens): Promise<boolean> {
  const { error } = await client
    .from("social_auth_handoffs")
    .update({ status: "ready", session })
    .eq("nonce", nonce)
    .eq("provider", provider)
    .eq("status", "pending");
  return !error;
}

// Read-and-consume a completed handoff exactly once. Returns the session only when it
// is ready and unexpired; the row is immediately marked consumed and its tokens erased.
export async function consumeHandoff(client: ServiceClient, nonce: string): Promise<{ status: "pending" | "ready" | "expired" | "unknown"; session: SocialSessionTokens | null }> {
  const { data, error } = await client
    .from("social_auth_handoffs")
    .select("status, session, expires_at")
    .eq("nonce", nonce)
    .maybeSingle();
  if (error || !data) return { status: "unknown", session: null };
  if (new Date(data.expires_at as string).getTime() <= Date.now()) {
    await client.from("social_auth_handoffs").delete().eq("nonce", nonce);
    return { status: "expired", session: null };
  }
  if (data.status !== "ready") return { status: "pending", session: null };

  await client.from("social_auth_handoffs").update({ status: "consumed", session: null }).eq("nonce", nonce);
  return { status: "ready", session: (data.session as SocialSessionTokens) ?? null };
}
