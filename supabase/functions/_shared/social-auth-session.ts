import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared helpers for the custom social sign-in Edge Functions (steam-auth, epic-auth).
// These mint a real Supabase session for an externally-verified identity using the
// service-role key, then park it in public.social_auth_handoffs for the initiating
// client to poll. SECURITY REVIEW REQUIRED before deploy/enable.

export type SocialSessionTokens = Readonly<{ access_token: string; refresh_token: string }>;
export type SocialAuthProvider = "steam" | "epic";
export type SocialHandoffStatus = "pending" | "ready" | "consumed" | "expired" | "unknown";

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
  const tokenHash = linked.data?.properties?.hashed_token;
  if (linked.error || !tokenHash) return null;

  // Verify through a separate ephemeral client. Supabase JS adopts the returned user
  // session after verifyOtp; using the service client here would silently replace its
  // service-role Authorization header and break the privileged handoff write below.
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  const verificationClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await verificationClient.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  const session = verified.data?.session;
  if (verified.error || !session?.access_token || !session.refresh_token) return null;

  return { access_token: session.access_token, refresh_token: session.refresh_token };
}

export async function createPendingHandoff(client: ServiceClient, nonce: string, provider: SocialAuthProvider): Promise<boolean> {
  await client.from("social_auth_handoffs").delete().lte("expires_at", new Date().toISOString());
  const { error } = await client.from("social_auth_handoffs").insert({ nonce, provider, status: "pending" });
  return !error;
}

export async function isPendingHandoff(client: ServiceClient, nonce: string, provider: SocialAuthProvider): Promise<boolean> {
  const { data, error } = await client
    .from("social_auth_handoffs")
    .select("nonce")
    .eq("nonce", nonce)
    .eq("provider", provider)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return !error && Boolean(data?.nonce);
}

export async function completeHandoff(client: ServiceClient, nonce: string, provider: SocialAuthProvider, session: SocialSessionTokens): Promise<boolean> {
  const { data, error } = await client
    .from("social_auth_handoffs")
    .update({ status: "ready", session })
    .eq("nonce", nonce)
    .eq("provider", provider)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("nonce")
    .maybeSingle();
  if (error) {
    const code = typeof error.code === "string"
      ? error.code.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80)
      : "unknown";
    throw new Error(`SOCIAL_HANDOFF_UPDATE_${code}`);
  }
  return Boolean(data?.nonce);
}

export async function consumeSocialAuthRateLimit(
  client: ServiceClient,
  request: Request,
  provider: SocialAuthProvider,
): Promise<{ allowed: boolean; retryAfterSeconds: number } | null> {
  const salt = Deno.env.get("SOCIAL_AUTH_RATE_LIMIT_SALT")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const clientAddress = request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || forwarded;
  if (!salt || !clientAddress || clientAddress.length > 128) return null;

  const bytes = new TextEncoder().encode(`${salt}:${provider}:${clientAddress}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const bucket = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  const { data, error } = await client.rpc("consume_social_auth_rate_limit", {
    target_bucket: bucket,
    max_requests: 10,
    window_seconds: 300,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row || typeof row.is_allowed !== "boolean") return null;
  return {
    allowed: row.is_allowed,
    retryAfterSeconds: Math.min(Math.max(Number(row.retry_after_seconds) || 1, 1), 3600),
  };
}

// The database function locks the handoff row and returns the old session while
// clearing it, making concurrent poll requests genuinely single-use.
export async function consumeHandoff(client: ServiceClient, nonce: string): Promise<{ status: SocialHandoffStatus; session: SocialSessionTokens | null }> {
  const { data, error } = await client.rpc("consume_social_auth_handoff", { target_nonce: nonce });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { status: "unknown", session: null };
  const allowedStatuses: SocialHandoffStatus[] = ["pending", "ready", "consumed", "expired", "unknown"];
  const status = allowedStatuses.includes(row.result_status as SocialHandoffStatus)
    ? row.result_status as SocialHandoffStatus
    : "unknown";
  return { status, session: status === "ready" ? (row.result_session as SocialSessionTokens) ?? null : null };
}
