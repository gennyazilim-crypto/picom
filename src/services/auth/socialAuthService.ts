import type { Provider, User } from "@supabase/supabase-js";
import { appConfig } from "../../config/appConfig";
import { dataSourceService } from "../dataSourceService";
import { externalLinkService } from "../desktop/externalLinkService";
import { getSupabaseClient } from "../supabase/supabaseClient";

export type SocialAuthProvider = "google" | "apple";
type SocialAuthResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type SocialProviderAccountState = Readonly<{ provider: SocialAuthProvider; label: "Google" | "Apple"; available: boolean; linked: boolean; reason?: string }>;
type OAuthDeliveryListener = (delivery: PicomOAuthDelivery) => void;

const accountProviders: readonly SocialAuthProvider[] = ["google", "apple"];
const deliveryListeners = new Set<OAuthDeliveryListener>();
const queuedDeliveries: PicomOAuthDelivery[] = [];
const seenResultIds = new Set<string>();
let nativeOAuthCleanup: (() => void) | null = null;
const providerLabel = (provider: SocialAuthProvider): "Google" | "Apple" => provider === "google" ? "Google" : "Apple";

function getDisplayName(user: User): string {
  const metadata = user.user_metadata ?? {};
  const candidates = [metadata.display_name, metadata.full_name, metadata.name];
  const value = candidates.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
  return value?.trim().slice(0, 80) || user.email?.split("@")[0]?.slice(0, 80) || "Picom User";
}
function getSafeUsername(user: User): string {
  const base = (user.email?.split("@")[0] || "user").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 24);
  return (base.length >= 3 ? base : "user") + "-" + user.id.replace(/-/g, "").slice(0, 6);
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
function dispatchOAuthDelivery(delivery: PicomOAuthDelivery): void {
  if (delivery.status !== "rejected") {
    if (seenResultIds.has(delivery.resultId)) return;
    seenResultIds.add(delivery.resultId);
  }
  if (!deliveryListeners.size) {
    queuedDeliveries.splice(0, queuedDeliveries.length, delivery);
    return;
  }
  for (const listener of deliveryListeners) listener(delivery);
}
async function beginDesktopAttempt(provider: SocialAuthProvider, purpose: PicomOAuthPurpose): Promise<SocialAuthResult<PicomOAuthAttempt>> {
  const native = window.picomDesktop?.auth;
  if (!native) return { ok: false, error: "Social sign in requires the Picom desktop runtime." };
  const result = await native.startOAuthAttempt({ provider, purpose });
  return result.ok ? { ok: true, data: result.attempt } : { ok: false, error: "Picom could not create a secure sign-in attempt." };
}
async function cancelDesktopAttempt(attemptId: string): Promise<void> {
  await window.picomDesktop?.auth?.cancelOAuthAttempt(attemptId).catch(() => undefined);
}
async function exchangeValidatedCode(code: string): Promise<SocialAuthResult<void>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "Supabase Auth is not configured." };
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error || !data.user) return { ok: false, error: "Social sign in could not be completed. Please try again." };
  return ensureProfile(data.user);
}
async function startProviderFlow(provider: SocialAuthProvider, purpose: PicomOAuthPurpose): Promise<SocialAuthResult<{ provider: SocialAuthProvider; message?: string }>> {
  const client = getSupabaseClient();
  if (!client) return { ok: false, error: "Supabase Auth is not configured." };
  const attempt = await beginDesktopAttempt(provider, purpose);
  if (!attempt.ok) return attempt;
  try {
    const response = purpose === "sign_in"
      ? await client.auth.signInWithOAuth({ provider: provider as Provider, options: { redirectTo: attempt.data.redirectUrl, skipBrowserRedirect: true } })
      : await client.auth.linkIdentity({ provider: provider as Provider, options: { redirectTo: attempt.data.redirectUrl, skipBrowserRedirect: true } });
    if (response.error || !response.data.url) {
      await cancelDesktopAttempt(attempt.data.attemptId);
      return { ok: false, error: "Picom could not start " + providerLabel(provider) + (purpose === "link" ? " account linking." : " sign in.") };
    }
    const opened = await externalLinkService.openExternalUrl(response.data.url);
    if (!opened.ok) {
      await cancelDesktopAttempt(attempt.data.attemptId);
      return { ok: false, error: externalLinkService.getUserFriendlyError(opened.reason) };
    }
    return { ok: true, data: { provider, message: purpose === "link" ? "Complete " + providerLabel(provider) + " connection in your browser, then return to Picom." : undefined } };
  } catch {
    await cancelDesktopAttempt(attempt.data.attemptId);
    return { ok: false, error: "Picom could not start a protected social authentication attempt." };
  }
}

export const socialAuthService = {
  getProviderAvailability(provider: SocialAuthProvider): { enabled: boolean; reason?: string } {
    const source = dataSourceService.getStatus();
    if (!source.isSupabase || !source.configured) return { enabled: false, reason: "Available when Supabase mode is configured." };
    const enabled = provider === "google" ? appConfig.supabase.googleOAuthEnabled : appConfig.supabase.appleOAuthEnabled;
    return enabled ? { enabled: true } : { enabled: false, reason: providerLabel(provider) + " provider setup is required." };
  },
  startNativeOAuthListener(): () => void {
    if (nativeOAuthCleanup) return nativeOAuthCleanup;
    const native = window.picomDesktop?.auth;
    if (!native) {
      nativeOAuthCleanup = () => undefined;
      return nativeOAuthCleanup;
    }
    nativeOAuthCleanup = native.onOAuthResult(dispatchOAuthDelivery);
    void native.getPendingOAuthResult().then((result) => {
      if (result.ok && result.result) dispatchOAuthDelivery(result.result);
    }).catch(() => undefined);
    return nativeOAuthCleanup;
  },
  onOAuthDelivery(listener: OAuthDeliveryListener): () => void {
    deliveryListeners.add(listener);
    for (const delivery of queuedDeliveries.splice(0)) listener(delivery);
    return () => deliveryListeners.delete(listener);
  },
  async completeOAuthDelivery(delivery: PicomOAuthDelivery): Promise<SocialAuthResult<{ message: string }>> {
    if (delivery.status === "rejected") return { ok: false, error: "Picom rejected an invalid, expired, or replayed social sign-in callback." };
    const acknowledge = async () => { await window.picomDesktop?.auth?.acknowledgeOAuthResult(delivery.resultId).catch(() => undefined); };
    if (delivery.status === "error") {
      await acknowledge();
      return { ok: false, error: delivery.error === "OAUTH_PROVIDER_CANCELLED" ? "Social sign in was canceled." : "The social provider could not complete sign in." };
    }
    if (delivery.provider !== "google" && delivery.provider !== "apple") {
      await acknowledge();
      return { ok: false, error: "This social provider is not enabled in Picom." };
    }
    if (!delivery.code) { await acknowledge(); return { ok: false, error: "Picom rejected a social callback without an authorization code." }; }
    const result = await exchangeValidatedCode(delivery.code);
    await acknowledge();
    return result.ok ? { ok: true, data: { message: delivery.purpose === "link" ? providerLabel(delivery.provider) + " was connected." : "Social sign in completed." } } : result;
  },
  async beginOAuth(provider: SocialAuthProvider): Promise<SocialAuthResult<{ provider: SocialAuthProvider }>> {
    const availability = this.getProviderAvailability(provider);
    if (!availability.enabled) return { ok: false, error: availability.reason ?? "This social provider is unavailable." };
    const result = await startProviderFlow(provider, "sign_in");
    return result.ok ? { ok: true, data: { provider } } : result;
  },
  async getAccountProviderStates(): Promise<SocialAuthResult<SocialProviderAccountState[]>> {
    const base = accountProviders.map((provider) => {
      const availability = socialAuthService.getProviderAvailability(provider);
      return { provider, label: providerLabel(provider), available: availability.enabled, linked: false, reason: availability.reason } satisfies SocialProviderAccountState;
    });
    if (dataSourceService.getStatus().isMock) return { ok: true, data: base };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase Auth is not configured." };
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { ok: false, error: "Sign in again to review connected providers." };
    const linked = new Set((data.user.identities ?? []).map((identity) => identity.provider));
    return { ok: true, data: base.map((state) => ({ ...state, linked: linked.has(state.provider), reason: linked.has(state.provider) ? state.label + " is connected to this Picom account." : state.reason })) };
  },
  async beginProviderLink(provider: SocialAuthProvider): Promise<SocialAuthResult<{ provider: SocialAuthProvider; message: string }>> {
    const availability = socialAuthService.getProviderAvailability(provider);
    if (!availability.enabled) return { ok: false, error: availability.reason ?? "This social provider is unavailable." };
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Supabase Auth is not configured." };
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { ok: false, error: "Sign in again before connecting a provider." };
    if ((data.user.identities ?? []).some((identity) => identity.provider === provider)) return { ok: true, data: { provider, message: providerLabel(provider) + " is already connected." } };
    const result = await startProviderFlow(provider, "link");
    return result.ok ? { ok: true, data: { provider, message: result.data.message ?? "Complete account linking in your browser." } } : result;
  },
};
