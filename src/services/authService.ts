import type { AuthError, Session, User } from "@supabase/supabase-js";
import { isMockMode } from "../config/appConfig";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";

export type AuthServiceUser = Readonly<{
  id: string;
  email: string | null;
  displayName: string | null;
}>;

export type AuthServiceSession = Readonly<{
  provider: "mock" | "supabase";
  user: AuthServiceUser | null;
  expiresAt: number | null;
}>;

export type AuthServiceErrorCode =
  | "AUTH_DISABLED"
  | "AUTH_NOT_CONFIGURED"
  | "AUTH_INVALID_INPUT"
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_SESSION_EXPIRED"
  | "AUTH_PROVIDER_ERROR";

export type AuthServiceError = Readonly<{
  code: AuthServiceErrorCode;
  message: string;
}>;

export type AuthServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: AuthServiceError }>;

export type AuthStateListener = (event: string, session: AuthServiceSession | null) => void;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function authError(code: AuthServiceErrorCode, message: string): AuthServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function mapSupabaseError(error: AuthError): AuthServiceError {
  const status = error.status ?? 0;

  if (status === 400 || status === 401) {
    return { code: "AUTH_INVALID_CREDENTIALS", message: "Email or password is incorrect." };
  }

  if (status === 403) {
    return { code: "AUTH_SESSION_EXPIRED", message: "Your session expired. Please sign in again." };
  }

  return { code: "AUTH_PROVIDER_ERROR", message: "Authentication failed. Please try again." };
}

function mapUser(user: User | null): AuthServiceUser | null {
  if (!user) return null;

  const displayName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null;

  return {
    id: user.id,
    email: user.email ?? null,
    displayName,
  };
}

function mapSession(session: Session | null): AuthServiceSession | null {
  if (!session) return null;

  return {
    provider: "supabase",
    user: mapUser(session.user),
    expiresAt: session.expires_at ?? null,
  };
}

function getMockSession(email = "mock@picom.local"): AuthServiceSession {
  return {
    provider: "mock",
    expiresAt: null,
    user: {
      id: "mock-current-user",
      email,
      displayName: "Picom Mock User",
    },
  };
}

function getConfiguredClient() {
  const status = getSupabaseClientStatus();

  if (!status.enabled && !isMockMode) {
    return authError("AUTH_DISABLED", "Authentication is disabled for the current data source.");
  }

  if (isMockMode) {
    return { ok: true as const, data: null };
  }

  if (!status.configured) {
    return authError("AUTH_NOT_CONFIGURED", status.reason ?? "Supabase Auth is not configured.");
  }

  const client = getSupabaseClient();
  if (!client) {
    return authError("AUTH_NOT_CONFIGURED", "Supabase client is unavailable.");
  }

  return { ok: true as const, data: client };
}

export const authService = {
  async signInWithEmailPassword(email: string, password: string): Promise<AuthServiceResult<AuthServiceSession>> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return authError("AUTH_INVALID_INPUT", "Email and password are required.");
    }

    const configured = getConfiguredClient();
    if (!configured.ok) return configured;

    if (!configured.data) {
      return { ok: true, data: getMockSession(normalizedEmail) };
    }

    const { data, error } = await configured.data.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      return { ok: false, error: mapSupabaseError(error) };
    }

    return { ok: true, data: mapSession(data.session) ?? getMockSession(normalizedEmail) };
  },

  async signUpWithEmailPassword(email: string, password: string, displayName?: string): Promise<AuthServiceResult<AuthServiceSession>> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return authError("AUTH_INVALID_INPUT", "Email and password are required.");
    }

    const configured = getConfiguredClient();
    if (!configured.ok) return configured;

    if (!configured.data) {
      return { ok: true, data: getMockSession(normalizedEmail) };
    }

    const { data, error } = await configured.data.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: displayName ? { display_name: displayName } : undefined,
      },
    });

    if (error) {
      return { ok: false, error: mapSupabaseError(error) };
    }

    return { ok: true, data: mapSession(data.session) ?? { provider: "supabase", user: mapUser(data.user), expiresAt: null } };
  },

  async getCurrentSession(): Promise<AuthServiceResult<AuthServiceSession | null>> {
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;

    if (!configured.data) {
      return { ok: true, data: null };
    }

    const { data, error } = await configured.data.auth.getSession();
    if (error) {
      return { ok: false, error: mapSupabaseError(error) };
    }

    return { ok: true, data: mapSession(data.session) };
  },

  async getCurrentUser(): Promise<AuthServiceResult<AuthServiceUser | null>> {
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;

    if (!configured.data) {
      return { ok: true, data: null };
    }

    const { data, error } = await configured.data.auth.getUser();
    if (error) {
      return { ok: false, error: mapSupabaseError(error) };
    }

    return { ok: true, data: mapUser(data.user) };
  },

  async signOut(): Promise<AuthServiceResult<void>> {
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;

    if (!configured.data) {
      return { ok: true, data: undefined };
    }

    const { error } = await configured.data.auth.signOut();
    if (error) {
      return { ok: false, error: mapSupabaseError(error) };
    }

    return { ok: true, data: undefined };
  },

  onAuthStateChange(listener: AuthStateListener): () => void {
    const configured = getConfiguredClient();
    if (!configured.ok || !configured.data) {
      return () => undefined;
    }

    const { data } = configured.data.auth.onAuthStateChange((event, session) => {
      listener(event, mapSession(session));
    });

    return () => data.subscription.unsubscribe();
  },
};