import type { Provider, User } from "@supabase/supabase-js";
import { appConfig } from "../../config/appConfig";
import { dataSourceService } from "../dataSourceService";
import { externalLinkService } from "../desktop/externalLinkService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { canUnlinkProvider, type LoginMethodSnapshot } from "./loginMethodGuards";

export type SocialAuthProvider = "google" | "apple" | "steam" | "epic";
type SocialAuthResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type SocialAuthProviderLabel = "Google" | "Apple" | "Steam" | "Epic";
export type SocialProviderAccountState = Readonly<{
  provider: SocialAuthProvider;
  label: SocialAuthProviderLabel;
  available: boolean;
  linked: boolean;
  linkedAt?: string | null;
  lastUsedAt?: string | null;
  reason?: string;
}>;

// Google/Apple use Supabase's native OAuth. Steam (OpenID 2.0) and Epic (OAuth2) have
// no native Supabase provider, so they run through the custom steam-auth / epic-auth
// Edge Functions (nonce + poll handoff). All four are gated by their own env flag, so a
// provider only appears once its backend is deployed and enabled.
export const SOCIAL_AUTH_PROVIDER_ORDER: readonly SocialAuthProvider[] = ["google", "apple", "steam", "epic"];
const CUSTOM_OAUTH_PROVIDERS: ReadonlySet<SocialAuthProvider> = new Set(["steam", "epic"]);

export function isCustomOAuthProvider(provider: SocialAuthProvider): boolean {
  return CUSTOM_OAUTH_PROVIDERS.has(provider);
}

function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const providerLabels: Record<SocialAuthProvider, SocialAuthProviderLabel> = {
  google: "Google",
  apple: "Apple",
  steam: "Steam",
  epic: "Epic",
};

export const getSocialAuthProviderLabel = (provider: SocialAuthProvider): SocialAuthProviderLabel => providerLabels[provider];

function isProviderOAuthEnabled(provider: SocialAuthProvider): boolean {
  switch (provider) {
    case "google":
      return appConfig.supabase.googleOAuthEnabled;
    case "apple":
      return appConfig.supabase.appleOAuthEnabled;
    case "steam":
      return appConfig.supabase.steamOAuthEnabled;
    case "epic":
      return appConfig.supabase.epicOAuthEnabled;
  }
}

function getDisplayName(user: User): string {
  const metadata = user.user_metadata ?? {};
  const candidates = [metadata.display_name, metadata.full_name, metadata.name];
  const value = candidates.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  return value?.trim().slice(0, 80) || user.email?.split("@")[0]?.slice(0, 80) || "Picom User";
}

function getSafeUsername(user: User): string {
  const base = (user.email?.split("@")[0] || "user")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 24);
  const safeBase = base.length >= 3 ? base : "user";
  return `${safeBase}-${user.id.replace(/-/g, "").slice(0, 6)}`;
}

async function ensureProfile(user: User): Promise<SocialAuthResult<void>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const avatarUrl = typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;
  const { error } = await client.from("profiles").upsert({
    id: user.id,
    username: getSafeUsername(user),
    display_name: getDisplayName(user),
    avatar_url: avatarUrl,
    status: "offline",
    status_text: "New to Picom",
    bio: null,
    accent_color: "#007571",
  }, { onConflict: "id", ignoreDuplicates: true });

  return error ? { ok: false, error: "Picom could not prepare the social profile." } : { ok: true, data: undefined };
}

async function buildLoginMethodSnapshot(user: User): Promise<LoginMethodSnapshot> {
  const client = getSupabaseClient();
  const native = (user.identities ?? [])
    .map((identity) => identity.provider)
    .filter((provider): provider is string => typeof provider === "string" && provider !== "email");
  const hasPassword = (user.identities ?? []).some((identity) => identity.provider === "email")
    || Boolean(user.email && !user.app_metadata?.picom_external_identity);

  const external: string[] = [];
  if (client) {
    const { data } = await client.rpc("list_my_social_auth_external_identities");
    for (const row of (data as Array<{ provider?: string }> | null) ?? []) {
      if (typeof row.provider === "string") external.push(row.provider);
    }
  }

  return {
    hasPassword,
    linkedProviders: [...new Set([...native, ...external])],
  };
}

export const socialAuthService = {
  // A provider whose backend is not live must not be advertised at all: a rendered
  // button can only fail on click (Supabase 400 for a disabled provider, 404 for an
  // undeployed custom OAuth function), which reads as a broken app rather than an
  // unconfigured one.
  getAvailableProviders(): readonly SocialAuthProvider[] {
    return SOCIAL_AUTH_PROVIDER_ORDER.filter((provider) => this.getProviderAvailability(provider).enabled);
  },

  getProviderAvailability(provider: SocialAuthProvider): { enabled: boolean; reason?: string } {
    const source = dataSourceService.getStatus();
    if (!source.isSupabase || !source.configured) {
      return { enabled: false, reason: "Available when Supabase mode is configured." };
    }

    // Product gates — never present Google/Epic as fully ready when paused/blocked.
    if (provider === "google") {
      return {
        enabled: false,
        reason: "PAUSED BY PRODUCT DECISION",
      };
    }
    if (provider === "epic") {
      const portalReady = String(import.meta.env.VITE_EPIC_PORTAL_READY || "").toLowerCase() === "true";
      if (!portalReady || !isProviderOAuthEnabled(provider)) {
        return {
          enabled: false,
          reason: "Kurulum bekleniyor — Epic portal entitlement required.",
        };
      }
    }

    const enabled = isProviderOAuthEnabled(provider);
    return enabled
      ? { enabled: true }
      : { enabled: false, reason: `${getSocialAuthProviderLabel(provider)} provider setup is required.` };
  },

  async beginOAuth(provider: SocialAuthProvider, preparedWindow?: Window | null): Promise<SocialAuthResult<{ provider: SocialAuthProvider }>> {
    const availability = this.getProviderAvailability(provider);
    if (!availability.enabled) { preparedWindow?.close(); return { ok: false, error: availability.reason ?? "This social provider is unavailable." }; }

    const client = getSupabaseClient();
    if (!client) { preparedWindow?.close(); return { ok: false, error: "Supabase Auth is not configured." }; }

    const { data, error } = await client.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo: appConfig.supabase.oauthRedirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) { preparedWindow?.close(); return { ok: false, error: `Picom could not start ${provider} sign in.` }; }

    // On the desktop app the native opener launches the system browser. In a plain
    // browser, navigate the popup that was opened synchronously on the click so it
    // survives the popup blocker (window.open after an await is otherwise blocked).
    const hasNativeOpener = Boolean(window.picomDesktop?.externalLinks?.openUrl);
    if (preparedWindow && !hasNativeOpener) {
      try {
        preparedWindow.location.href = data.url;
        return { ok: true, data: { provider } };
      } catch {
        preparedWindow.close();
        return { ok: false, error: externalLinkService.getUserFriendlyError("EXTERNAL_URL_OPEN_FAILED") };
      }
    }

    const openResult = await externalLinkService.openExternalUrl(data.url);
    if (!openResult.ok) { preparedWindow?.close(); return { ok: false, error: externalLinkService.getUserFriendlyError(openResult.reason) }; }
    return { ok: true, data: { provider } };
  },

  // Custom (non-Supabase-native) providers: Steam (OpenID 2.0) and Epic (OAuth2). The
  // provider-specific Edge Function verifies the external identity and mints a Supabase
  // session; the client opens the login page then polls the function for the session
  // (nonce-keyed, single-use). Inert until the function is deployed and the provider
  // flag is enabled.
  async beginCustomOAuth(provider: SocialAuthProvider, preparedWindow?: Window | null): Promise<SocialAuthResult<{ provider: SocialAuthProvider }>> {
    const availability = this.getProviderAvailability(provider);
    if (!availability.enabled) { preparedWindow?.close(); return { ok: false, error: availability.reason ?? "This social provider is unavailable." }; }
    const client = getSupabaseClient();
    if (!client) { preparedWindow?.close(); return { ok: false, error: "Supabase Auth is not configured." }; }
    const base = appConfig.supabase.url.replace(/\/+$/, "");
    if (!base) { preparedWindow?.close(); return { ok: false, error: `${getSocialAuthProviderLabel(provider)} sign in is not configured.` }; }

    const nonce = generateNonce();
    // Steam/Epic browser entry must be branded auth.picom.gg gateway — never raw *.supabase.co.
    const brandedApi = appConfig.authGatewayUrl.replace(/\/+$/, "");
    const loginUrl = `${brandedApi}/${provider}/start?nonce=${encodeURIComponent(nonce)}`;
    if (/supabase\.(co|in)/i.test(loginUrl)) {
      preparedWindow?.close();
      return { ok: false, error: `${getSocialAuthProviderLabel(provider)} sign-in is misconfigured.` };
    }
    const functionUrl = `${base}/functions/v1/${provider}-auth`;
    const hasNativeOpener = Boolean(window.picomDesktop?.externalLinks?.openUrl);
    if (preparedWindow && !hasNativeOpener) {
      try { preparedWindow.location.href = loginUrl; } catch { preparedWindow.close(); return { ok: false, error: externalLinkService.getUserFriendlyError("EXTERNAL_URL_OPEN_FAILED") }; }
    } else {
      const openResult = await externalLinkService.openExternalUrl(loginUrl);
      if (!openResult.ok) { preparedWindow?.close(); return { ok: false, error: externalLinkService.getUserFriendlyError(openResult.reason) }; }
    }

    const deadline = Date.now() + 150_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      let payload: { status?: string; session?: { access_token?: string; refresh_token?: string } | null } | null = null;
      try {
        const response = await fetch(`${functionUrl}?action=poll&nonce=${encodeURIComponent(nonce)}`, { headers: { apikey: appConfig.supabase.anonKey } });
        payload = await response.json();
      } catch { payload = null; }
      if (!payload) continue;
      if (payload.status === "ready" && payload.session?.access_token && payload.session.refresh_token) {
        const { data, error } = await client.auth.setSession({ access_token: payload.session.access_token, refresh_token: payload.session.refresh_token });
        if (error || !data.user) return { ok: false, error: `${getSocialAuthProviderLabel(provider)} sign in could not be completed.` };
        const profileResult = await ensureProfile(data.user);
        return profileResult.ok ? { ok: true, data: { provider } } : { ok: false, error: profileResult.error };
      }
      if (payload.status === "expired" || payload.status === "consumed") break;
    }
    return { ok: false, error: `${getSocialAuthProviderLabel(provider)} sign in timed out. Please try again.` };
  },

  async getAccountProviderStates(): Promise<SocialAuthResult<SocialProviderAccountState[]>> {
    const base = SOCIAL_AUTH_PROVIDER_ORDER.map((provider) => {
      const availability = socialAuthService.getProviderAvailability(provider);
      return {
        provider,
        label: getSocialAuthProviderLabel(provider),
        available: availability.enabled,
        linked: false,
        reason: availability.reason,
      } satisfies SocialProviderAccountState;
    });
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase Auth is not configured." };
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { ok: false, error: "Sign in again to review connected providers." };

    const linkedNative = new Set((data.user.identities ?? []).map((identity) => identity.provider));
    const externalMeta = new Map<string, { linkedAt?: string | null; lastUsedAt?: string | null }>();
    const { data: externalRows } = await client.rpc("list_my_social_auth_external_identities");
    for (const row of (externalRows as Array<{ provider?: string; linked_at?: string; last_used_at?: string }> | null) ?? []) {
      if (typeof row.provider !== "string") continue;
      linkedNative.add(row.provider);
      externalMeta.set(row.provider, { linkedAt: row.linked_at ?? null, lastUsedAt: row.last_used_at ?? null });
    }

    return {
      ok: true,
      data: base.map((state) => {
        const linked = linkedNative.has(state.provider);
        const meta = externalMeta.get(state.provider);
        return {
          ...state,
          linked,
          linkedAt: meta?.linkedAt,
          lastUsedAt: meta?.lastUsedAt,
          reason: linked
            ? `${state.label} is connected to this Picom account.`
            : state.reason,
        };
      }),
    };
  },

  async beginProviderLink(provider: SocialAuthProvider): Promise<SocialAuthResult<{ provider: SocialAuthProvider; message: string }>> {
    const availability = socialAuthService.getProviderAvailability(provider);
    if (!availability.enabled) return { ok: false, error: availability.reason ?? "This social provider is unavailable." };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase Auth is not configured." };
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return { ok: false, error: "Sign in again before connecting a provider." };

    if (isCustomOAuthProvider(provider)) {
      const states = await this.getAccountProviderStates();
      if (states.ok && states.data.find((row) => row.provider === provider)?.linked) {
        return { ok: true, data: { provider, message: `${getSocialAuthProviderLabel(provider)} is already connected.` } };
      }

      await client.auth.refreshSession().catch(() => null);
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return { ok: false, error: "Sign in again before connecting a provider." };

      const base = appConfig.supabase.url.replace(/\/+$/, "");
      const functionUrl = `${base}/functions/v1/${provider}-auth`;
      const nonce = generateNonce();
      let startPayload: { ok?: boolean; loginUrl?: string; code?: string } | null = null;
      try {
        const response = await fetch(`${functionUrl}?action=start-link&nonce=${encodeURIComponent(nonce)}`, {
          method: "POST",
          headers: {
            apikey: appConfig.supabase.anonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
        startPayload = await response.json().catch(() => null);
        if (!response.ok || !startPayload?.loginUrl) {
          const code = String(startPayload?.code || "").toLowerCase();
          if (response.status === 401 || code === "unauthorized") {
            return { ok: false, error: "Sign in again before connecting a provider." };
          }
          if (response.status === 429 || code === "rate_limited") {
            return { ok: false, error: "Too many connection attempts. Try again shortly." };
          }
          if (response.status === 503 || code === "unavailable" || code === "not_configured") {
            return { ok: false, error: `${getSocialAuthProviderLabel(provider)} linking is temporarily unavailable.` };
          }
          return { ok: false, error: `Picom could not start ${getSocialAuthProviderLabel(provider)} account linking.` };
        }
      } catch {
        return {
          ok: false,
          error: `Picom could not start ${getSocialAuthProviderLabel(provider)} account linking. Check your connection and try again.`,
        };
      }

      let linkLoginUrl = startPayload.loginUrl;
      // Prefer server-issued branded gateway URL; never open supabase.co in the browser.
      if (/supabase\.(co|in)/i.test(linkLoginUrl) || !/^https:\/\/auth\.picom\.gg\//i.test(linkLoginUrl)) {
        linkLoginUrl = `${appConfig.authGatewayUrl}/${provider}/start?nonce=${encodeURIComponent(nonce)}`;
      }

      const openResult = await externalLinkService.openExternalUrl(linkLoginUrl);
      if (!openResult.ok) return { ok: false, error: externalLinkService.getUserFriendlyError(openResult.reason) };

      const deadline = Date.now() + 150_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        try {
          const response = await fetch(`${functionUrl}?action=poll&nonce=${encodeURIComponent(nonce)}`, {
            headers: { apikey: appConfig.supabase.anonKey },
          });
          const payload = await response.json() as { status?: string; linked?: boolean };
          if (payload.status === "ready" && payload.linked) {
            return {
              ok: true,
              data: {
                provider,
                message: `${getSocialAuthProviderLabel(provider)} is connected. Security email will arrive from verify@picom.gg when delivery is configured.`,
              },
            };
          }
          if (payload.status === "expired" || payload.status === "consumed") break;
        } catch {
          /* keep polling */
        }
      }
      return { ok: false, error: `${getSocialAuthProviderLabel(provider)} linking timed out. Please try again.` };
    }

    if ((userData.user.identities ?? []).some((identity) => identity.provider === provider)) {
      return { ok: true, data: { provider, message: `${getSocialAuthProviderLabel(provider)} is already connected.` } };
    }
    const { data, error } = await client.auth.linkIdentity({
      provider: provider as Provider,
      options: { redirectTo: appConfig.supabase.oauthRedirectUrl, skipBrowserRedirect: true },
    });
    if (error || !data.url) return { ok: false, error: `Picom could not start ${getSocialAuthProviderLabel(provider)} account linking.` };
    const openResult = await externalLinkService.openExternalUrl(data.url);
    if (!openResult.ok) return { ok: false, error: externalLinkService.getUserFriendlyError(openResult.reason) };
    return { ok: true, data: { provider, message: `Complete ${getSocialAuthProviderLabel(provider)} connection in your browser, then return to Picom.` } };
  },

  async unlinkProvider(provider: SocialAuthProvider): Promise<SocialAuthResult<{ provider: SocialAuthProvider; message: string }>> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase Auth is not configured." };
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return { ok: false, error: "Sign in again before disconnecting a provider." };

    const snapshot = await buildLoginMethodSnapshot(userData.user);
    const guard = canUnlinkProvider(snapshot, provider);
    if (!guard.ok) {
      if (guard.reason === "last_method") {
        return { ok: false, error: "Add another sign-in method before disconnecting your last login option." };
      }
      return { ok: false, error: `${getSocialAuthProviderLabel(provider)} is not connected.` };
    }

    if (isCustomOAuthProvider(provider)) {
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return { ok: false, error: "Sign in again before disconnecting a provider." };
      const base = appConfig.supabase.url.replace(/\/+$/, "");
      try {
        const response = await fetch(`${base}/functions/v1/${provider}-auth?action=unlink`, {
          method: "POST",
          headers: {
            apikey: appConfig.supabase.anonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ confirm: true }),
        });
        const payload = await response.json().catch(() => ({})) as { code?: string };
        if (!response.ok) {
          if (payload.code === "last_method") {
            return { ok: false, error: "Add another sign-in method before disconnecting your last login option." };
          }
          return { ok: false, error: `${getSocialAuthProviderLabel(provider)} could not be disconnected.` };
        }
      } catch {
        return { ok: false, error: `${getSocialAuthProviderLabel(provider)} could not be disconnected.` };
      }
      return { ok: true, data: { provider, message: `${getSocialAuthProviderLabel(provider)} was disconnected.` } };
    }

    const identity = (userData.user.identities ?? []).find((row) => row.provider === provider);
    if (!identity?.identity_id) return { ok: false, error: `${getSocialAuthProviderLabel(provider)} is not connected.` };
    const { error } = await client.auth.unlinkIdentity(identity);
    if (error) return { ok: false, error: `${getSocialAuthProviderLabel(provider)} could not be disconnected.` };

    await client.rpc("audit_provider_connection_change", {
      target_provider: provider,
      target_event: "provider_unlinked",
    });

    return { ok: true, data: { provider, message: `${getSocialAuthProviderLabel(provider)} was disconnected.` } };
  },

  async completeOAuthCallback(code: string): Promise<SocialAuthResult<void>> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase Auth is not configured." };

    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.user) return { ok: false, error: "Social sign in could not be completed. Please try again." };
    return ensureProfile(data.user);
  },
};
