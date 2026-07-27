import type { Session } from "@supabase/supabase-js";
import { APP_ORIGIN } from "../config";

const SOURCE_KEY = "picom.account.continueSource";
const NONCE_KEY = "picom.account.continueNonce";

export type ContinueSource = "desktop" | "web" | "account";

function isContinueSource(value: string | null | undefined): value is ContinueSource {
  return value === "desktop" || value === "web" || value === "account";
}

/** Persist ?source= and optional ?nonce= across Account Center SPA navigations. */
export function captureContinueContextFromLocation(search: string = typeof window !== "undefined" ? window.location.search : ""): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const params = new URLSearchParams(search);
    const source = params.get("source");
    if (isContinueSource(source)) {
      sessionStorage.setItem(SOURCE_KEY, source);
    }
    const nonce = params.get("nonce");
    if (nonce && /^[A-Za-z0-9_-]{32,128}$/.test(nonce)) {
      sessionStorage.setItem(NONCE_KEY, nonce);
    }
  } catch {
    // ignore
  }
}

export function readContinueSource(): ContinueSource {
  if (typeof sessionStorage !== "undefined") {
    try {
      const stored = sessionStorage.getItem(SOURCE_KEY);
      if (isContinueSource(stored)) return stored;
    } catch {
      // ignore
    }
  }
  if (typeof window !== "undefined") {
    const fromUrl = new URLSearchParams(window.location.search).get("source");
    if (isContinueSource(fromUrl)) return fromUrl;
  }
  // Stay in Account Center when the user opened it without a product source.
  return "account";
}

export function readContinueNonce(): string | null {
  if (typeof sessionStorage !== "undefined") {
    try {
      const stored = sessionStorage.getItem(NONCE_KEY);
      if (stored && /^[A-Za-z0-9_-]{32,128}$/.test(stored)) return stored;
    } catch {
      // ignore
    }
  }
  if (typeof window !== "undefined") {
    const fromUrl = new URLSearchParams(window.location.search).get("nonce");
    if (fromUrl && /^[A-Za-z0-9_-]{32,128}$/.test(fromUrl)) return fromUrl;
  }
  return null;
}

function clearContinueNonce(): void {
  try {
    sessionStorage.removeItem(NONCE_KEY);
  } catch {
    // ignore
  }
}

function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function sessionContinueUrl(): string {
  const base = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/functions/v1/session-continue`;
}

async function parkSessionHandoff(session: Session, nonce: string): Promise<boolean> {
  const url = sessionContinueUrl();
  if (!url.startsWith("http")) return false;
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nonce,
        refresh_token: session.refresh_token,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export type ContinueResult =
  | { redirected: true; target: "desktop" | "web" }
  | { redirected: false; reason: "stay" | "handoff_failed" };

/**
 * After successful register/login: send the user into Desktop or app.picom.gg
 * already signed in (via one-time nonce handoff).
 *
 * @param preferProduct — registration always continues into the product when
 *   source is missing (Account Center home register → app.picom.gg).
 */
export async function continueToProduct(
  session: Session,
  options?: { preferProduct?: boolean },
): Promise<ContinueResult> {
  captureContinueContextFromLocation();
  let source = readContinueSource();
  if (options?.preferProduct && source === "account") {
    source = "web";
  }

  if (source === "account") {
    return { redirected: false, reason: "stay" };
  }

  if (!session.access_token || !session.refresh_token) {
    return { redirected: false, reason: "handoff_failed" };
  }

  const nonce = readContinueNonce() ?? generateNonce();
  const parked = await parkSessionHandoff(session, nonce);
  if (!parked) {
    return { redirected: false, reason: "handoff_failed" };
  }
  clearContinueNonce();

  if (source === "desktop") {
    // Wake desktop if it is not already polling; Desktop also polls when it opened register.
    window.location.href = `picom://auth/session?nonce=${encodeURIComponent(nonce)}`;
    return { redirected: true, target: "desktop" };
  }

  const target = new URL("/auth/handoff", APP_ORIGIN);
  target.searchParams.set("nonce", nonce);
  window.location.assign(target.toString());
  return { redirected: true, target: "web" };
}
