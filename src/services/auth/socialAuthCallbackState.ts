export type SocialAuthCallbackProvider = "google" | "steam" | "epic" | "apple";
export type SocialAuthCallbackPurpose = "sign-in" | "link";

type PendingSocialAuthCallback = Readonly<{
  state: string;
  provider: SocialAuthCallbackProvider;
  purpose: SocialAuthCallbackPurpose;
  expiresAt: number;
}>;

const STORAGE_KEY = "picom.auth.social-callback.v1";
const CALLBACK_TTL_MS = 5 * 60_000;
const MAX_PENDING_CALLBACKS = 6;
let memoryFallback: PendingSocialAuthCallback[] = [];

function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isPendingCallback(value: unknown): value is PendingSocialAuthCallback {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.state === "string"
    && /^[A-Za-z0-9_-]{32,128}$/.test(item.state)
    && (item.provider === "google" || item.provider === "steam" || item.provider === "epic" || item.provider === "apple")
    && (item.purpose === "sign-in" || item.purpose === "link")
    && typeof item.expiresAt === "number"
    && Number.isFinite(item.expiresAt)
  );
}

function readPendingCallbacks(): PendingSocialAuthCallback[] {
  const storage = getStorage();
  if (!storage) return memoryFallback;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isPendingCallback) : [];
  } catch {
    return [];
  }
}

function writePendingCallbacks(items: PendingSocialAuthCallback[]): void {
  memoryFallback = items;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // The in-memory copy keeps the current running app safe if storage is unavailable.
  }
}

function prune(items: PendingSocialAuthCallback[], now = Date.now()): PendingSocialAuthCallback[] {
  return items.filter((item) => item.expiresAt > now).slice(-MAX_PENDING_CALLBACKS);
}

export function createSocialAuthCallbackState(
  provider: SocialAuthCallbackProvider,
  purpose: SocialAuthCallbackPurpose,
): string {
  const state = generateState();
  const pending = prune(readPendingCallbacks());
  pending.push({ state, provider, purpose, expiresAt: Date.now() + CALLBACK_TTL_MS });
  writePendingCallbacks(prune(pending));
  return state;
}

export function consumeSocialAuthCallbackState(input: Readonly<{
  state: string;
  provider: SocialAuthCallbackProvider;
}>): { ok: true; purpose: SocialAuthCallbackPurpose } | { ok: false } {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(input.state)) return { ok: false };
  const pending = prune(readPendingCallbacks());
  const match = pending.find((item) => item.state === input.state && item.provider === input.provider);
  // Consume before exchanging so replay and duplicate desktop callback delivery fail closed.
  writePendingCallbacks(pending.filter((item) => item.state !== input.state));
  return match ? { ok: true, purpose: match.purpose } : { ok: false };
}

export function buildSocialGatewayCallbackUrl(provider: SocialAuthCallbackProvider, state: string): string {
  const url = new URL(`https://auth.picom.gg/${provider}/callback`);
  url.searchParams.set("state", state);
  return url.toString();
}
