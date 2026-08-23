import type { Provider, User } from "@supabase/supabase-js";
import { appConfig } from "../../config/appConfig";
import { dataSourceService } from "../dataSourceService";
import { externalLinkService } from "../desktop/externalLinkService";
import type { AuthServiceErrorCode } from "../authService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { beginAuthAttempt, finishAuthAttempt, markAuthAttemptExchanging } from "./authAttemptStore";
import { canUnlinkProvider, type LoginMethodSnapshot } from "./loginMethodGuards";
import {
  buildSocialGatewayCallbackUrl,
  consumeSocialAuthCallbackState,
  createSocialAuthCallbackState,
} from "./socialAuthCallbackState";

export type SocialAuthProvider = "google" | "apple" | "steam" | "epic";
type SocialAuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: AuthServiceErrorCode };
export type SocialAuthProviderLabel = "Google" | "Apple" | "Steam" | "Epic Games";
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
// Edge Functions (one-time callback exchange). All four are gated by their own env flag, so a
// provider only appears once its backend is deployed and enabled.
export const SOCIAL_AUTH_PROVIDER_ORDER: readonly SocialAuthProvider[] = ["google", "apple", "steam", "epic"];
const CUSTOM_OAUTH_PROVIDERS: ReadonlySet<SocialAuthProvider> = new Set(["steam", "epic"]);

export function isCustomOAuthProvider(provider: SocialAuthProvider): boolean {
  return CUSTOM_OAUTH_PROVIDERS.has(provider);
}

const providerLabels: Record<SocialAuthProvider, SocialAuthProviderLabel> = {
  google: "Google",
  apple: "Apple",
  steam: "Steam",
  epic: "Epic Games",
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

function socialFail(code: AuthServiceErrorCode, error: string): SocialAuthResult<never> {
  return { ok: false, error, code };
}

function mapProviderCallbackFailure(message: string | null | undefined): AuthServiceErrorCode {
  const text = String(message ?? "");
  if (/already.?linked|identity.?exists|already been (linked|registered)/i.test(text)) return "AUTH_IDENTITY_ALREADY_LINKED";
  if (/network|fetch|offline|timeout/i.test(text)) return "AUTH_NETWORK_ERROR";
  if (/rate.?limit|too many/i.test(text)) return "AUTH_RATE_LIMITED";
  return "AUTH_CALLBACK_FAILED";
}

async function ensureProfile(user: User): Promise<SocialAuthResult<void>> {
  const client = getSupabaseClient();
  if (!client) return socialFail("AUTH_NOT_CONFIGURED", "Supabase is not configured.");

  // The Auth profile trigger is the canonical provisioning authority. The renderer
  // verifies its result and must never fabricate a profile from provider metadata.
  const { data, error } = await client.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (error || !data) return socialFail("AUTH_SESSION_FAILED", "Picom profile provisioning could not be verified. Please sign in again.");
  return { ok: true, data: undefined };
}

function buildGoogleGatewayStartUrl(authorizeUrl: string, state: string): string | null {
  try {
    const authorize = new URL(authorizeUrl);
    const configuredSupabase = new URL(appConfig.supabase.url);
    const expectedCallback = buildSocialGatewayCallbackUrl("google", state);
    if (
      authorize.origin !== configuredSupabase.origin
      || authorize.pathname !== "/auth/v1/authorize"
      || authorize.searchParams.get("provider") !== "google"
      || authorize.searchParams.get("redirect_to") !== expectedCallback
      || !authorize.searchParams.get("code_challenge")
    ) return null;

    const start = new URL(`${appConfig.authGatewayUrl}/google/start`);
    start.searchParams.set("state", state);
    start.searchParams.set("authorize", btoa(authorize.toString()).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
    return start.toString();
  } catch {
    return null;
  }
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
    if (provider === "epic") {
      const portalReady = String(import.meta.env.VITE_EPIC_PORTAL_READY || "").toLowerCase() === "true";
      if (!portalReady || !isProviderOAuthEnabled(provider)) {
        return {
          enabled: false,
          reason: `${getSocialAuthProviderLabel(provider)} provider setup is required.`,
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
    if (!availability.enabled) { preparedWindow?.close(); return { ok: false, error: availability.reason ?? "This social provider is unavailable.", code: "AUTH_PROVIDER_FAILED" }; }

    const client = getSupabaseClient();
    if (!client) { preparedWindow?.close(); return { ok: false, error: "Supabase Auth is not configured.", code: "AUTH_NOT_CONFIGURED" }; }

    const state = createSocialAuthCallbackState(provider, "sign-in");
    const { data, error } = await client.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo: buildSocialGatewayCallbackUrl(provider, state),
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) { preparedWindow?.close(); return { ok: false, error: `Picom could not start ${provider} sign in.`, code: "AUTH_PROVIDER_FAILED" }; }
    const loginUrl = provider === "google" ? buildGoogleGatewayStartUrl(data.url, state) : data.url;
    if (!loginUrl) { preparedWindow?.close(); return { ok: false, error: "Google sign-in is misconfigured.", code: "AUTH_PROVIDER_FAILED" }; }

    // On the desktop app the native opener launches the system browser. In a plain
    // browser, navigate the popup that was opened synchronously on the click so it
    // survives the popup blocker (window.open after an await is otherwise blocked).
    const hasNativeOpener = Boolean(window.picomDesktop?.externalLinks?.openUrl);
    if (preparedWindow && !hasNativeOpener) {
      try {
        preparedWindow.location.href = loginUrl;
        beginAuthAttempt(provider, "sign-in");
        return { ok: true, data: { provider } };
      } catch {
        preparedWindow.close();
        return { ok: false, error: externalLinkService.getUserFriendlyError("EXTERNAL_URL_OPEN_FAILED"), code: "AUTH_NETWORK_ERROR" };
      }
    }

    const openResult = await externalLinkService.openExternalUrl(loginUrl);
    if (!openResult.ok) { preparedWindow?.close(); return { ok: false, error: externalLinkService.getUserFriendlyError(openResult.reason), code: "AUTH_NETWORK_ERROR" }; }
    beginAuthAttempt(provider, "sign-in");
    return { ok: true, data: { provider } };
  },

  // Custom (non-Supabase-native) providers: Steam (OpenID 2.0) and Epic (OAuth2). The
  // provider-specific Edge Function verifies the external identity and mints a Supabase
// session; the client returns through a one-time desktop callback exchange. Inert until the function is deployed and the provider
  // flag is enabled.
  async beginCustomOAuth(provider: SocialAuthProvider, preparedWindow?: Window | null): Promise<SocialAuthResult<{ provider: SocialAuthProvider }>> {
    const availability = this.getProviderAvailability(provider);
    if (!availability.enabled) { preparedWindow?.close(); return { ok: false, error: availability.reason ?? "This social provider is unavailable.", code: "AUTH_PROVIDER_FAILED" }; }
    const client = getSupabaseClient();
    if (!client) { preparedWindow?.close(); return { ok: false, error: "Supabase Auth is not configured.", code: "AUTH_NOT_CONFIGURED" }; }
    const nonce = createSocialAuthCallbackState(provider, "sign-in");
    // Steam/Epic browser entry must be branded auth.picom.gg gateway — never raw *.supabase.co.
    const brandedApi = appConfig.authGatewayUrl.replace(/\/+$/, "");
    const loginUrl = `${brandedApi}/${provider}/start?nonce=${encodeURIComponent(nonce)}`;
    if (/supabase\.(co|in)/i.test(loginUrl)) {
      preparedWindow?.close();
      return { ok: false, error: `${getSocialAuthProviderLabel(provider)} sign-in is misconfigured.`, code: "AUTH_PROVIDER_FAILED" };
    }
    const hasNativeOpener = Boolean(window.picomDesktop?.externalLinks?.openUrl);
    if (preparedWindow && !hasNativeOpener) {
      try { preparedWindow.location.href = loginUrl; } catch { preparedWindow.close(); return { ok: false, error: externalLinkService.getUserFriendlyError("EXTERNAL_URL_OPEN_FAILED"), code: "AUTH_NETWORK_ERROR" }; }
    } else {
      const openResult = await externalLinkService.openExternalUrl(loginUrl);
      if (!openResult.ok) { preparedWindow?.close(); return { ok: false, error: externalLinkService.getUserFriendlyError(openResult.reason), code: "AUTH_NETWORK_ERROR" }; }
    }

    beginAuthAttempt(provider, "sign-in");
    return { ok: true, data: { provider } };
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
    if (!client) return socialFail("AUTH_NOT_CONFIGURED", "Supabase Auth is not configured.");
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return socialFail("AUTH_SESSION_FAILED", "Sign in again to review connected providers.");

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
    if (!availability.enabled) return socialFail("AUTH_PROVIDER_FAILED", availability.reason ?? "This social provider is unavailable.");
    const client = getSupabaseClient();
    if (!client) return socialFail("AUTH_NOT_CONFIGURED", "Supabase Auth is not configured.");
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return socialFail("AUTH_SESSION_FAILED", "Sign in again before connecting a provider.");

    if (isCustomOAuthProvider(provider)) {
      const states = await this.getAccountProviderStates();
      if (states.ok && states.data.find((row) => row.provider === provider)?.linked) {
        return { ok: true, data: { provider, message: `${getSocialAuthProviderLabel(provider)} is already connected.` } };
      }

      await client.auth.refreshSession().catch(() => null);
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return socialFail("AUTH_SESSION_FAILED", "Sign in again before connecting a provider.");

      const base = appConfig.supabase.url.replace(/\/+$/, "");
      const functionUrl = `${base}/functions/v1/${provider}-auth`;
      const nonce = createSocialAuthCallbackState(provider, "link");
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
            return socialFail("AUTH_SESSION_FAILED", "Sign in again before connecting a provider.");
          }
          if (response.status === 429 || code === "rate_limited") {
            return socialFail("AUTH_RATE_LIMITED", "Too many connection attempts. Try again shortly.");
          }
          if (response.status === 503 || code === "unavailable" || code === "not_configured") {
            return socialFail("AUTH_PROVIDER_FAILED", `${getSocialAuthProviderLabel(provider)} linking is temporarily unavailable.`);
          }
          if (code === "identity_already_linked" || code === "already_linked") {
            return socialFail("AUTH_IDENTITY_ALREADY_LINKED", `${getSocialAuthProviderLabel(provider)} is already linked to another Picom account.`);
          }
          return socialFail("AUTH_PROVIDER_FAILED", `Picom could not start ${getSocialAuthProviderLabel(provider)} account linking.`);
        }
      } catch {
        return socialFail("AUTH_NETWORK_ERROR", `Picom could not start ${getSocialAuthProviderLabel(provider)} account linking. Check your connection and try again.`);
      }

      let linkLoginUrl = startPayload.loginUrl;
      // Prefer server-issued branded gateway URL; never open supabase.co in the browser.
      if (/supabase\.(co|in)/i.test(linkLoginUrl) || !/^https:\/\/auth\.picom\.gg\//i.test(linkLoginUrl)) {
        linkLoginUrl = `${appConfig.authGatewayUrl}/${provider}/start?nonce=${encodeURIComponent(nonce)}`;
      }

      const openResult = await externalLinkService.openExternalUrl(linkLoginUrl);
      if (!openResult.ok) return socialFail("AUTH_NETWORK_ERROR", externalLinkService.getUserFriendlyError(openResult.reason));
      beginAuthAttempt(provider, "link");
      return {
        ok: true,
        data: {
          provider,
          message: `Complete ${getSocialAuthProviderLabel(provider)} connection in your browser, then return to Picom.`,
        },
      };
    }

    if ((userData.user.identities ?? []).some((identity) => identity.provider === provider)) {
      return { ok: true, data: { provider, message: `${getSocialAuthProviderLabel(provider)} is already connected.` } };
    }
    const state = createSocialAuthCallbackState(provider, "link");
    const { data, error } = await client.auth.linkIdentity({
      provider: provider as Provider,
      options: { redirectTo: buildSocialGatewayCallbackUrl(provider, state), skipBrowserRedirect: true },
    });
    if (error || !data.url) return socialFail("AUTH_PROVIDER_FAILED", `Picom could not start ${getSocialAuthProviderLabel(provider)} account linking.`);
    const loginUrl = provider === "google" ? buildGoogleGatewayStartUrl(data.url, state) : data.url;
    if (!loginUrl) return socialFail("AUTH_PROVIDER_FAILED", "Google account linking is misconfigured.");
    const openResult = await externalLinkService.openExternalUrl(loginUrl);
    if (!openResult.ok) return socialFail("AUTH_NETWORK_ERROR", externalLinkService.getUserFriendlyError(openResult.reason));
    beginAuthAttempt(provider, "link");
    return { ok: true, data: { provider, message: `Complete ${getSocialAuthProviderLabel(provider)} connection in your browser, then return to Picom.` } };
  },

  async unlinkProvider(provider: SocialAuthProvider): Promise<SocialAuthResult<{ provider: SocialAuthProvider; message: string }>> {
    const client = getSupabaseClient();
    if (!client) return socialFail("AUTH_NOT_CONFIGURED", "Supabase Auth is not configured.");
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return socialFail("AUTH_SESSION_FAILED", "Sign in again before disconnecting a provider.");

    const snapshot = await buildLoginMethodSnapshot(userData.user);
    const guard = canUnlinkProvider(snapshot, provider);
    if (!guard.ok) {
      if (guard.reason === "last_method") {
        return socialFail("AUTH_INVALID_INPUT", "Add another sign-in method before disconnecting your last login option.");
      }
      return socialFail("AUTH_INVALID_INPUT", `${getSocialAuthProviderLabel(provider)} is not connected.`);
    }

    if (isCustomOAuthProvider(provider)) {
      const { data: sessionData } = await client.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return socialFail("AUTH_SESSION_FAILED", "Sign in again before disconnecting a provider.");
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
            return socialFail("AUTH_INVALID_INPUT", "Add another sign-in method before disconnecting your last login option.");
          }
          return socialFail("AUTH_PROVIDER_FAILED", `${getSocialAuthProviderLabel(provider)} could not be disconnected.`);
        }
      } catch {
        return socialFail("AUTH_NETWORK_ERROR", `${getSocialAuthProviderLabel(provider)} could not be disconnected.`);
      }
      return { ok: true, data: { provider, message: `${getSocialAuthProviderLabel(provider)} was disconnected.` } };
    }

    const identity = (userData.user.identities ?? []).find((row) => row.provider === provider);
    if (!identity?.identity_id) return socialFail("AUTH_INVALID_INPUT", `${getSocialAuthProviderLabel(provider)} is not connected.`);
    const { error } = await client.auth.unlinkIdentity(identity);
    if (error) return socialFail("AUTH_PROVIDER_FAILED", `${getSocialAuthProviderLabel(provider)} could not be disconnected.`);

    await client.rpc("audit_provider_connection_change", {
      target_provider: provider,
      target_event: "provider_unlinked",
    });

    return { ok: true, data: { provider, message: `${getSocialAuthProviderLabel(provider)} was disconnected.` } };
  },

  rejectPendingCallback(provider: SocialAuthProvider, state?: string, errorCode: AuthServiceErrorCode = "AUTH_CANCELLED"): SocialAuthResult<void> {
    if (state) consumeSocialAuthCallbackState({ state, provider });
    finishAuthAttempt(provider);
    return socialFail(errorCode, errorCode === "AUTH_CANCELLED" ? "Sign-in was cancelled." : "Social sign in could not be completed.");
  },

  async completeOAuthCallback(
    code: string,
    state: string,
    provider: Extract<SocialAuthProvider, "google" | "apple">,
  ): Promise<SocialAuthResult<void>> {
    markAuthAttemptExchanging(provider);
    const pending = consumeSocialAuthCallbackState({ state, provider });
    if (!pending.ok) {
      finishAuthAttempt(provider);
      return socialFail("AUTH_CALLBACK_FAILED", "This sign-in link is invalid or has already been used. Please try again.");
    }
    const client = getSupabaseClient();
    if (!client) {
      finishAuthAttempt(provider);
      return socialFail("AUTH_NOT_CONFIGURED", "Supabase Auth is not configured.");
    }

    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      finishAuthAttempt(provider);
      return socialFail(mapProviderCallbackFailure(error?.message), "Social sign in could not be completed. Please try again.");
    }
    const profile = await ensureProfile(data.user);
    finishAuthAttempt(provider);
    if (!profile.ok) return profile;
    return pending.purpose === "link"
      ? { ok: true, data: undefined }
      : profile;
  },

  async completeCustomOAuthCallback(
    exchange: string,
    provider: Extract<SocialAuthProvider, "steam" | "epic">,
  ): Promise<SocialAuthResult<{ linked: boolean }>> {
    markAuthAttemptExchanging(provider);
    const pending = consumeSocialAuthCallbackState({ state: exchange, provider });
    if (!pending.ok) {
      finishAuthAttempt(provider);
      return socialFail("AUTH_CALLBACK_FAILED", "This sign-in link is invalid or has already been used. Please try again.");
    }
    const client = getSupabaseClient();
    if (!client) {
      finishAuthAttempt(provider);
      return socialFail("AUTH_NOT_CONFIGURED", "Supabase Auth is not configured.");
    }

    const base = appConfig.supabase.url.replace(/\/+$/, "");
    try {
      const response = await fetch(`${base}/functions/v1/${provider}-auth?action=exchange&nonce=${encodeURIComponent(exchange)}`, {
        headers: { apikey: appConfig.supabase.anonKey },
      });
      const payload = await response.json().catch(() => null) as {
        status?: string;
        code?: string;
        linked?: boolean;
        session?: { access_token?: string; refresh_token?: string } | null;
      } | null;
      if (!response.ok || payload?.status !== "ready") {
        finishAuthAttempt(provider);
        return socialFail(mapProviderCallbackFailure(payload?.code), "Social sign in could not be completed. Please try again.");
      }
      if (payload.linked || pending.purpose === "link") {
        finishAuthAttempt(provider);
        return { ok: true, data: { linked: true } };
      }

      const accessToken = payload.session?.access_token;
      const refreshToken = payload.session?.refresh_token;
      if (!accessToken || !refreshToken) {
        finishAuthAttempt(provider);
        return socialFail("AUTH_SESSION_FAILED", "Social sign in could not be completed. Please try again.");
      }
      const { data, error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error || !data.user) {
        finishAuthAttempt(provider);
        return socialFail("AUTH_SESSION_FAILED", "Social sign in could not be completed. Please try again.");
      }
      const profile = await ensureProfile(data.user);
      finishAuthAttempt(provider);
      return profile.ok ? { ok: true, data: { linked: false } } : profile;
    } catch {
      finishAuthAttempt(provider);
      return socialFail("AUTH_NETWORK_ERROR", "Social sign in could not be completed. Check your connection and try again.");
    }
  },
};
