import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared helpers for the custom social sign-in Edge Functions (steam-auth, epic-auth).
// A service-role-only mapping binds each verified provider identity to exactly one
// Supabase user. Sessions are parked in public.social_auth_handoffs for the
// initiating client to poll.

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

type ExternalIdentityInput = Readonly<{
  provider: SocialAuthProvider;
  externalId: string;
  metadata: Record<string, unknown>;
}>;

type MappedUser = Readonly<{ id: string; email: string }>;

function normalizeExternalId(value: string): string | null {
  const externalId = value.trim();
  return externalId.length >= 1 && externalId.length <= 160 && !/[\s\u0000-\u001f\u007f]/.test(externalId)
    ? externalId
    : null;
}

async function getMappedUser(
  client: ServiceClient,
  provider: SocialAuthProvider,
  externalId: string,
): Promise<MappedUser | null> {
  const { data: mapping, error: mappingError } = await client
    .from("social_auth_external_identities")
    .select("user_id")
    .eq("provider", provider)
    .eq("external_id", externalId)
    .maybeSingle();
  if (mappingError || !mapping?.user_id) return null;

  const { data, error } = await client.auth.admin.getUserById(mapping.user_id);
  const user = data?.user;
  if (error || !user?.email) return null;
  if (user.app_metadata?.picom_external_provider !== provider
    || user.app_metadata?.picom_external_id !== externalId) return null;

  const { error: touchError } = await client
    .from("social_auth_external_identities")
    .update({ last_used_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("external_id", externalId)
    .eq("user_id", user.id);
  return touchError ? null : { id: user.id, email: user.email };
}

async function resolveOrCreateMappedUser(
  client: ServiceClient,
  identity: ExternalIdentityInput,
): Promise<MappedUser | null> {
  const externalId = normalizeExternalId(identity.externalId);
  if (!externalId) return null;

  const existing = await getMappedUser(client, identity.provider, externalId);
  if (existing) return existing;

  // The email is an internal Auth transport identifier only. Its random component
  // prevents public provider IDs from becoming pre-registerable account handles.
  const opaqueId = crypto.randomUUID().replaceAll("-", "");
  const email = `${identity.provider}_${opaqueId}@external.users.picom.local`;
  const created = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: identity.metadata,
    app_metadata: {
      picom_external_identity: true,
      picom_external_provider: identity.provider,
      picom_external_id: externalId,
    },
  });
  const createdUser = created.data?.user;
  if (created.error || !createdUser?.email) return null;

  const { error: insertError } = await client.from("social_auth_external_identities").insert({
    provider: identity.provider,
    external_id: externalId,
    user_id: createdUser.id,
  });
  if (!insertError) return { id: createdUser.id, email: createdUser.email };

  // A concurrent verified callback may have won the unique mapping race. Remove
  // this now-unmapped user and use only the database winner.
  await client.auth.admin.deleteUser(createdUser.id);
  return getMappedUser(client, identity.provider, externalId);
}

// Resolve the provider mapping, then mint a session from a one-time token entirely
// server-side. Provider IDs and public profile fields never select a user by email.
export async function mintSessionForIdentity(
  client: ServiceClient,
  identity: ExternalIdentityInput,
): Promise<SocialSessionTokens | null> {
  const mappedUser = await resolveOrCreateMappedUser(client, identity);
  if (!mappedUser) return null;

  const linked = await client.auth.admin.generateLink({ type: "magiclink", email: mappedUser.email });
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

export type SocialHandoffPurpose = "login" | "link";

export type PendingHandoffRow = Readonly<{
  nonce: string;
  purpose: SocialHandoffPurpose;
  link_user_id: string | null;
}>;

export async function createPendingHandoff(
  client: ServiceClient,
  nonce: string,
  provider: SocialAuthProvider,
  options: Readonly<{ purpose?: SocialHandoffPurpose; linkUserId?: string }> = {},
): Promise<boolean> {
  await client.from("social_auth_handoffs").delete().lte("expires_at", new Date().toISOString());
  const purpose = options.purpose ?? "login";
  const { error } = await client.from("social_auth_handoffs").insert({
    nonce,
    provider,
    status: "pending",
    purpose,
    link_user_id: purpose === "link" ? options.linkUserId ?? null : null,
  });
  return !error;
}

export async function getPendingHandoff(
  client: ServiceClient,
  nonce: string,
  provider: SocialAuthProvider,
): Promise<PendingHandoffRow | null> {
  const { data, error } = await client
    .from("social_auth_handoffs")
    .select("nonce,purpose,link_user_id")
    .eq("nonce", nonce)
    .eq("provider", provider)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data?.nonce) return null;
  const purpose = data.purpose === "link" ? "link" : "login";
  return {
    nonce: data.nonce,
    purpose,
    link_user_id: typeof data.link_user_id === "string" ? data.link_user_id : null,
  };
}

export async function isPendingHandoff(client: ServiceClient, nonce: string, provider: SocialAuthProvider): Promise<boolean> {
  return Boolean(await getPendingHandoff(client, nonce, provider));
}

/** Bind a verified provider identity to an already-authenticated Picom user. */
export async function linkIdentityToUser(
  client: ServiceClient,
  identity: ExternalIdentityInput,
  userId: string,
): Promise<{ ok: true } | { ok: false; code: "invalid_identity" | "already_linked_other" | "already_linked_self" | "insert_failed" }> {
  const externalId = normalizeExternalId(identity.externalId);
  if (!externalId || !userId) return { ok: false, code: "invalid_identity" };

  const { data: existing, error: existingError } = await client
    .from("social_auth_external_identities")
    .select("user_id")
    .eq("provider", identity.provider)
    .eq("external_id", externalId)
    .maybeSingle();
  if (existingError) return { ok: false, code: "insert_failed" };
  if (existing?.user_id === userId) return { ok: false, code: "already_linked_self" };
  if (existing?.user_id) return { ok: false, code: "already_linked_other" };

  const { data: userOwned, error: ownedError } = await client
    .from("social_auth_external_identities")
    .select("external_id")
    .eq("provider", identity.provider)
    .eq("user_id", userId)
    .maybeSingle();
  if (ownedError) return { ok: false, code: "insert_failed" };
  if (userOwned?.external_id) return { ok: false, code: "already_linked_self" };

  const { error: insertError } = await client.from("social_auth_external_identities").insert({
    provider: identity.provider,
    external_id: externalId,
    user_id: userId,
  });
  if (insertError) return { ok: false, code: "insert_failed" };

  await client.from("account_security_events").insert({
    user_id: userId,
    event_type: "provider_linked",
    metadata: { provider: identity.provider },
  });
  return { ok: true };
}

export async function unlinkIdentityFromUser(
  client: ServiceClient,
  provider: SocialAuthProvider,
  userId: string,
): Promise<{ ok: true } | { ok: false; code: "not_linked" | "last_method" | "delete_failed" }> {
  const { data: mapping, error: mappingError } = await client
    .from("social_auth_external_identities")
    .select("external_id")
    .eq("provider", provider)
    .eq("user_id", userId)
    .maybeSingle();
  if (mappingError || !mapping?.external_id) return { ok: false, code: "not_linked" };

  const { data: userData, error: userError } = await client.auth.admin.getUserById(userId);
  if (userError || !userData?.user) return { ok: false, code: "delete_failed" };

  const identities = userData.user.identities ?? [];
  const hasPassword = identities.some((row) => row.provider === "email")
    || Boolean(userData.user.email && !userData.user.app_metadata?.picom_external_identity);
  const nativeProviders = identities
    .map((row) => row.provider)
    .filter((p): p is string => typeof p === "string" && p !== "email");

  const { data: externalRows } = await client
    .from("social_auth_external_identities")
    .select("provider")
    .eq("user_id", userId);
  const externalProviders = (externalRows ?? [])
    .map((row) => row.provider)
    .filter((p): p is string => typeof p === "string");

  const remainingNative = nativeProviders;
  const remainingExternal = externalProviders.filter((p) => p !== provider);
  const remainingCount = (hasPassword ? 1 : 0)
    + new Set([...remainingNative, ...remainingExternal]).size;
  if (remainingCount < 1) return { ok: false, code: "last_method" };

  const { error: deleteError } = await client
    .from("social_auth_external_identities")
    .delete()
    .eq("provider", provider)
    .eq("user_id", userId)
    .eq("external_id", mapping.external_id);
  if (deleteError) return { ok: false, code: "delete_failed" };

  await client.from("account_security_events").insert({
    user_id: userId,
    event_type: "provider_unlinked",
    metadata: { provider },
  });
  return { ok: true };
}

export async function resolveCallerUserId(request: Request, client: ServiceClient): Promise<string | null> {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const token = match?.[1]?.trim();
  if (!token || token.length < 20 || token.length > 4096) return null;
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user?.id ? null : data.user.id;
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
