import type { Provider, User } from "@supabase/supabase-js";
import { appConfig } from "../../config/appConfig";
import { dataSourceService } from "../dataSourceService";
import { externalLinkService } from "../desktop/externalLinkService";
import { getSupabaseClient } from "../supabase/supabaseClient";

export type SocialAuthProvider = "google" | "apple" | "steam" | "epic";
type SocialAuthResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type SocialAuthProviderLabel = "Google" | "Apple" | "Steam" | "Epic";
export type SocialProviderAccountState = Readonly<{
  provider: SocialAuthProvider;
  label: SocialAuthProviderLabel;
  available: boolean;
  linked: boolean;
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

export const socialAuthService = {
  getProviderAvailability(provider: SocialAuthProvider): { enabled: boolean; reason?: string } {
    const source = dataSourceService.getStatus();
    if (!source.isSupabase || !source.configured) {
      return { enabled: false, reason: "Available when Supabase mode is configured." };
    }

    const enabled = isProviderOAuthEnabled(provider);
    return enabled ? { enabled: true } : { enabled: false, reason: `${getSocialAuthProviderLabel(provider)} provider setup is required.` };
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
    const functionUrl = `${base}/functions/v1/${provider}-auth`;
    const loginUrl = `${functionUrl}?action=login&nonce=${encodeURIComponent(nonce)}`;
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
      return { provider, label: getSocialAuthProviderLabel(provider), available: availability.enabled, linked: false, reason: availability.reason } satisfies SocialProviderAccountState;
    });
    if (dataSourceService.getStatus().isMock) return { ok: true, data: base };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase Auth is not configured." };
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { ok: false, error: "Sign in again to review connected providers." };
    const linked = new Set((data.user.identities ?? []).map((identity) => identity.provider));
    return { ok: true, data: base.map((state) => ({ ...state, linked: linked.has(state.provider), reason: linked.has(state.provider) ? `${state.label} is connected to this Picom account.` : state.reason })) };
  },

  async beginProviderLink(provider: SocialAuthProvider): Promise<SocialAuthResult<{ provider: SocialAuthProvider; message: string }>> {
    const availability = socialAuthService.getProviderAvailability(provider);
    if (!availability.enabled) return { ok: false, error: availability.reason ?? "This social provider is unavailable." };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase Auth is not configured." };
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return { ok: false, error: "Sign in again before connecting a provider." };
    if ((userData.user.identities ?? []).some((identity) => identity.provider === provider)) return { ok: true, data: { provider, message: `${getSocialAuthProviderLabel(provider)} is already connected.` } };
    const { data, error } = await client.auth.linkIdentity({
      provider: provider as Provider,
      options: { redirectTo: appConfig.supabase.oauthRedirectUrl, skipBrowserRedirect: true },
    });
    if (error || !data.url) return { ok: false, error: `Picom could not start ${getSocialAuthProviderLabel(provider)} account linking.` };
    const openResult = await externalLinkService.openExternalUrl(data.url);
    if (!openResult.ok) return { ok: false, error: externalLinkService.getUserFriendlyError(openResult.reason) };
    return { ok: true, data: { provider, message: `Complete ${getSocialAuthProviderLabel(provider)} connection in your browser, then return to Picom.` } };
  },

  async completeOAuthCallback(code: string): Promise<SocialAuthResult<void>> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase Auth is not configured." };

    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.user) return { ok: false, error: "Social sign in could not be completed. Please try again." };
    return ensureProfile(data.user);
  },
};
