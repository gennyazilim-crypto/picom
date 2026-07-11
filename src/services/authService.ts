import type { AuthError, Session, User } from "@supabase/supabase-js";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";
import { legalConfig } from "../config/legalConfig";
import { termsAcceptanceService } from "./termsAcceptanceService";
import { isRateLimitError, rateLimitUserMessage } from "./rateLimitError";
import { appConfig } from "../config/appConfig";

let lastPasswordResetRequestAt = 0;
const PASSWORD_RESET_COOLDOWN_MS = 60_000;
let lastEmailVerificationRequestAt = 0;
const EMAIL_VERIFICATION_COOLDOWN_MS = 60_000;

export type AuthServiceUser = Readonly<{
  id: string;
  email: string | null;
  displayName: string | null;
  emailVerifiedAt?: string | null;
}>;

export type AuthServiceSession = Readonly<{
  provider: "mock" | "supabase";
  user: AuthServiceUser | null;
  expiresAt: number | null;
}>;

export type AuthSignUpOutcome = Readonly<{
  session: AuthServiceSession | null;
  user: AuthServiceUser | null;
  requiresEmailVerification: boolean;
  message: string;
}>;

export type PasswordResetRequestSummary = Readonly<{
  provider: "mock" | "supabase";
  message: string;
}>;

export type PasswordChangeSummary = Readonly<{
  provider: "mock" | "supabase";
  message: string;
  sessionsRevoked: boolean;
}>;

export type EmailVerificationRequestSummary = Readonly<{
  provider: "mock" | "supabase";
  message: string;
}>;

export type ReauthenticationSummary = Readonly<{ reauthenticatedAt: string; provider: "mock" | "supabase" }>;

export type AuthServiceErrorCode =
  | "AUTH_DISABLED"
  | "AUTH_NOT_CONFIGURED"
  | "AUTH_INVALID_INPUT"
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_RATE_LIMITED"
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

  if (isRateLimitError(error)) {
    return { code: "AUTH_RATE_LIMITED", message: rateLimitUserMessage };
  }

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
    emailVerifiedAt: user.email_confirmed_at ?? null,
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
        emailVerifiedAt: null,
      },
  };
}

function getPasswordResetSafeMessage(): string {
  return "If an account exists for that email, password reset instructions will be prepared.";
}

function getEmailVerificationSafeMessage(): string {
  return "If verification is available for this account, email verification instructions will be prepared.";
}

function getConfiguredClient() {
  const dataSourceStatus = dataSourceService.getStatus();

  if (dataSourceStatus.isMock) {
    return { ok: true as const, data: null };
  }

  const status = getSupabaseClientStatus();

  if (!status.enabled) {
    return authError("AUTH_DISABLED", "Authentication is disabled for the current data source.");
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
  async reauthenticateCurrentUser(password: string): Promise<AuthServiceResult<ReauthenticationSummary>> {
    if (password.length < 8) return authError("AUTH_INVALID_INPUT", "Enter your current password to continue.");
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;
    if (!configured.data) return { ok: true, data: { reauthenticatedAt: new Date().toISOString(), provider: "mock" } };
    const { data: current, error: currentError } = await configured.data.auth.getUser();
    const email = current.user?.email;
    if (currentError || !email) return authError("AUTH_SESSION_EXPIRED", "Sign in again before deleting your account.");
    const { data, error } = await configured.data.auth.signInWithPassword({ email, password });
    if (error || !data.session) return error ? { ok: false, error: mapSupabaseError(error) } : authError("AUTH_INVALID_CREDENTIALS", "Your current password could not be verified.");
    return { ok: true, data: { reauthenticatedAt: new Date().toISOString(), provider: "supabase" } };
  },

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

    const session = mapSession(data.session);
    if (!session?.user) return authError("AUTH_PROVIDER_ERROR", "Supabase did not create a valid session. Please sign in again.");
    return { ok: true, data: session };
  },

  async signUpWithEmailPassword(email: string, password: string, displayName: string | undefined, acceptedLegalVersion: string): Promise<AuthServiceResult<AuthSignUpOutcome>> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return authError("AUTH_INVALID_INPUT", "Email and password are required.");
    }
    if (acceptedLegalVersion !== legalConfig.currentVersion) return authError("AUTH_INVALID_INPUT", "Accept the current Terms of Service and Privacy Notice before registering.");

    const configured = getConfiguredClient();
    if (!configured.ok) return configured;

    if (!configured.data) {
      const session = getMockSession(normalizedEmail);
      if (session.user) termsAcceptanceService.recordMockRegistrationAcceptance(session.user.id);
      return { ok: true, data: { session, user: session.user, requiresEmailVerification: false, message: "Picom mock account created." } };
    }

    const { data, error } = await configured.data.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { ...(displayName ? { display_name: displayName } : {}), accepted_terms_version: legalConfig.termsVersion, accepted_privacy_version: legalConfig.privacyVersion },
      },
    });

    if (error) {
      return { ok: false, error: mapSupabaseError(error) };
    }

    const session = mapSession(data.session);
    const user = mapUser(data.user);
    if (!session && !user) return authError("AUTH_PROVIDER_ERROR", "Supabase did not return an account or session.");
    return {
      ok: true,
      data: {
        session,
        user,
        requiresEmailVerification: !session,
        message: session ? "Picom account created and signed in." : "Account created. Check your email to verify the account, then sign in.",
      },
    };
  },

  async requestPasswordReset(email: string): Promise<AuthServiceResult<PasswordResetRequestSummary>> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return authError("AUTH_INVALID_INPUT", "Email is required.");
    }

    const configured = getConfiguredClient();
    if (!configured.ok) return configured;

    const now = Date.now();
    if (now - lastPasswordResetRequestAt < PASSWORD_RESET_COOLDOWN_MS) return authError("AUTH_RATE_LIMITED", "Please wait before requesting another password reset email.");
    lastPasswordResetRequestAt = now;

    if (!configured.data) {
      return {
        ok: true,
        data: {
          provider: "mock",
          message: getPasswordResetSafeMessage(),
        },
      };
    }

    const { error } = await configured.data.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: appConfig.supabase.passwordResetRedirectUrl });
    if (error && isRateLimitError(error)) return authError("AUTH_RATE_LIMITED", rateLimitUserMessage);

    return {
      ok: true,
      data: {
        provider: "supabase",
        message: getPasswordResetSafeMessage(),
      },
    };
  },

  async preparePasswordRecovery(code: string): Promise<AuthServiceResult<{ message: string }>> {
    if (!/^[a-zA-Z0-9._~-]{8,1024}$/.test(code)) return authError("AUTH_INVALID_INPUT", "This password reset link is invalid or expired.");
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;
    if (!configured.data) return { ok: true, data: { message: "Mock password recovery is ready." } };
    const { error } = await configured.data.auth.exchangeCodeForSession(code);
    if (error) return authError("AUTH_SESSION_EXPIRED", "This password reset link is invalid or expired. Request a new one.");
    return { ok: true, data: { message: "Choose a new password to finish recovery." } };
  },

  async confirmPasswordReset(newPassword: string): Promise<AuthServiceResult<{ message: string }>> {
    if (newPassword.length < 12) return authError("AUTH_INVALID_INPUT", "New password must be at least 12 characters.");
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;
    if (!configured.data) return { ok: true, data: { message: "Password updated in mock recovery mode. Sign in again." } };
    const { error } = await configured.data.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: mapSupabaseError(error) };
    await configured.data.auth.signOut({ scope: "global" });
    return { ok: true, data: { message: "Password updated. All sessions were signed out; sign in with your new password." } };
  },

  async changeCurrentPassword(currentPassword: string, newPassword: string): Promise<AuthServiceResult<PasswordChangeSummary>> {
    if (currentPassword.length < 8) return authError("AUTH_INVALID_INPUT", "Enter your current password to continue.");
    if (newPassword.length < 12) return authError("AUTH_INVALID_INPUT", "New password must be at least 12 characters.");
    if (Object.is(currentPassword, newPassword)) return authError("AUTH_INVALID_INPUT", "Choose a new password that differs from your current password.");
    const reauthentication = await authService.reauthenticateCurrentUser(currentPassword);
    if (!reauthentication.ok) return reauthentication;
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;
    if (!configured.data) return { ok: true, data: { provider: "mock", message: "Mock password change completed. Sign in again to continue.", sessionsRevoked: true } };
    const { error } = await configured.data.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: mapSupabaseError(error) };
    const { error: signOutError } = await configured.data.auth.signOut({ scope: "global" });
    if (signOutError) return authError("AUTH_PROVIDER_ERROR", "Password changed, but global session revocation could not be confirmed. Sign out on every device and contact support.");
    return { ok: true, data: { provider: "supabase", message: "Password changed and all sessions revoked. Sign in with your new password.", sessionsRevoked: true } };
  },

  async requestEmailVerification(email?: string): Promise<AuthServiceResult<EmailVerificationRequestSummary>> {
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;

    if (!configured.data) {
      return {
        ok: true,
        data: {
          provider: "mock",
          message: getEmailVerificationSafeMessage(),
        },
      };
    }

    const targetEmail = normalizeEmail(email ?? "");
    const currentUserEmail = (await configured.data.auth.getUser()).data.user?.email ?? "";
    const emailForResend = targetEmail || currentUserEmail;
    if (!emailForResend) {
      return authError("AUTH_INVALID_INPUT", "Email is required.");
    }

    const now = Date.now();
    if (now - lastEmailVerificationRequestAt < EMAIL_VERIFICATION_COOLDOWN_MS) return authError("AUTH_RATE_LIMITED", "Please wait before requesting another verification email.");
    lastEmailVerificationRequestAt = now;

    const { error } = await configured.data.auth.resend({ type: "signup", email: emailForResend, options: { emailRedirectTo: appConfig.supabase.emailVerificationRedirectUrl } });
    if (error && isRateLimitError(error)) return authError("AUTH_RATE_LIMITED", rateLimitUserMessage);

    return {
      ok: true,
      data: {
        provider: "supabase",
        message: getEmailVerificationSafeMessage(),
      },
    };
  },

  async confirmEmailVerification(code: string): Promise<AuthServiceResult<{ message: string; verifiedAt: string | null }>> {
    if (!/^[a-zA-Z0-9._~-]{8,1024}$/.test(code)) return authError("AUTH_INVALID_INPUT", "This email verification link is invalid or expired.");
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;
    if (!configured.data) return { ok: true, data: { message: "Mock email verification completed.", verifiedAt: new Date().toISOString() } };
    const { error } = await configured.data.auth.exchangeCodeForSession(code);
    if (error) return authError("AUTH_SESSION_EXPIRED", "This email verification link is invalid or expired. Request a new one.");
    const { data, error: userError } = await configured.data.auth.getUser();
    if (userError || !data.user?.email_confirmed_at) return authError("AUTH_PROVIDER_ERROR", "Email verification could not be confirmed. Request a new link.");
    return { ok: true, data: { message: "Email address verified.", verifiedAt: data.user.email_confirmed_at } };
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

    let session = data.session;
    if (!session) return { ok: true, data: null };
    if ((session.expires_at ?? 0) <= Math.floor(Date.now() / 1000) + 30) {
      const refreshed = await configured.data.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session) {
        await configured.data.auth.signOut({ scope: "local" });
        return authError("AUTH_SESSION_EXPIRED", "Your session expired. Please sign in again.");
      }
      session = refreshed.data.session;
    }
    const verified = await configured.data.auth.getUser();
    if (verified.error || !verified.data.user || verified.data.user.id !== session.user.id) {
      await configured.data.auth.signOut({ scope: "local" });
      return authError("AUTH_SESSION_EXPIRED", "Your session is no longer valid. Please sign in again.");
    }
    return { ok: true, data: mapSession({ ...session, user: verified.data.user }) };
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

    const { error } = await configured.data.auth.signOut({ scope: "local" });
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
