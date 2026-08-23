import type { SocialAuthProvider } from "./socialAuthService";
import type { SocialAuthCallbackPurpose } from "./socialAuthCallbackState";

export type AuthAttemptStatus = "connecting" | "exchanging";

export type AuthAttempt = Readonly<{
  provider: SocialAuthProvider;
  purpose: SocialAuthCallbackPurpose;
  status: AuthAttemptStatus;
  startedAt: number;
}>;

type Listener = (attempt: AuthAttempt | null) => void;

const TIMEOUT_MS = 3 * 60_000;
const listeners = new Set<Listener>();
let current: AuthAttempt | null = null;
let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  for (const listener of listeners) listener(current);
}

function clearTimeoutHandle(): void {
  if (timeoutHandle === null) return;
  clearTimeout(timeoutHandle);
  timeoutHandle = null;
}

export function getAuthAttempt(): AuthAttempt | null {
  return current;
}

export function subscribeAuthAttempt(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function beginAuthAttempt(provider: SocialAuthProvider, purpose: SocialAuthCallbackPurpose): void {
  clearTimeoutHandle();
  current = { provider, purpose, status: "connecting", startedAt: Date.now() };
  timeoutHandle = setTimeout(() => {
    current = null;
    timeoutHandle = null;
    emit();
  }, TIMEOUT_MS);
  emit();
}

export function markAuthAttemptExchanging(provider?: SocialAuthProvider): void {
  if (!current) return;
  if (provider && current.provider !== provider) return;
  current = { ...current, status: "exchanging" };
  emit();
}

export function finishAuthAttempt(provider?: SocialAuthProvider): void {
  if (provider && current && current.provider !== provider) return;
  clearTimeoutHandle();
  current = null;
  emit();
}
