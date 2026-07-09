import type { Provider, User } from "@supabase/supabase-js";
import { appConfig } from "../../config/appConfig";
import { dataSourceService } from "../dataSourceService";
import { externalLinkService } from "../desktop/externalLinkService";
import { getSupabaseClient } from "../supabase/supabaseClient";

export type SocialAuthProvider = "google" | "apple";
type SocialAuthResult<T> = { ok: true; data: T } | { ok: false; error: string };

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

    const enabled = provider === "google" ? appConfig.supabase.googleOAuthEnabled : appConfig.supabase.appleOAuthEnabled;
    return enabled ? { enabled: true } : { enabled: false, reason: `${provider === "google" ? "Google" : "Apple"} provider setup is required.` };
  },

  async beginOAuth(provider: SocialAuthProvider): Promise<SocialAuthResult<{ provider: SocialAuthProvider }>> {
    const availability = this.getProviderAvailability(provider);
    if (!availability.enabled) return { ok: false, error: availability.reason ?? "This social provider is unavailable." };

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase Auth is not configured." };

    const { data, error } = await client.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo: appConfig.supabase.oauthRedirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) return { ok: false, error: `Picom could not start ${provider} sign in.` };
    const openResult = await externalLinkService.openExternalUrl(data.url);
    if (!openResult.ok) return { ok: false, error: externalLinkService.getUserFriendlyError(openResult.reason) };
    return { ok: true, data: { provider } };
  },

  async completeOAuthCallback(code: string): Promise<SocialAuthResult<void>> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase Auth is not configured." };

    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.user) return { ok: false, error: "Social sign in could not be completed. Please try again." };
    return ensureProfile(data.user);
  },
};
