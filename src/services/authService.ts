import type { AuthError, Session, User } from "@supabase/supabase-js";
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
  /** Auth account creation time (ISO). Used for Account Center "Member since". */
  createdAt?: string | null;
}>;

export type AuthServiceSession = Readonly<{
  provider: "mock" | "supabase";
  user: AuthServiceUser | null;
  expiresAt: number | null;
}>;

export type AuthMfaChallenge = Readonly<{
  factorId: string;
  challengeId: string;
}>;

export type AuthSignInOutcome =
  | Readonly<{ kind: "session"; session: AuthServiceSession }>
  | Readonly<{ kind: "mfa_required"; challenge: AuthMfaChallenge }>;

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
  | "AUTH_ACCOUNT_RESTRICTED"
  | "AUTH_RATE_LIMITED"
  | "AUTH_SESSION_EXPIRED"
  | "AUTH_PROVIDER_ERROR"
  // Canonical V2 codes. Legacy aliases above remain for existing call sites.
  | "AUTH_NETWORK_ERROR"
  | "AUTH_ACCOUNT_DISABLED"
  | "AUTH_PROVIDER_FAILED"
  | "AUTH_CALLBACK_FAILED"
  | "AUTH_SESSION_FAILED"
  | "AUTH_IDENTITY_ALREADY_LINKED"
  | "AUTH_CANCELLED";

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
  const message = String(error.message ?? "");

  if (isRateLimitError(error)) {
    return { code: "AUTH_RATE_LIMITED", message: rateLimitUserMessage };
  }

  if (status === 0 || /network|fetch|offline|failed to fetch|timeout/i.test(message)) {
    return { code: "AUTH_NETWORK_ERROR", message: "We could not reach authentication. Check your connection and try again." };
  }

  if (/disabled|banned|deactivated|suspended/i.test(message)) {
    return { code: "AUTH_ACCOUNT_DISABLED", message: "This account is unavailable. Contact support if you believe this is a mistake." };
  }

  // Hosted Auth returns this when custom SMTP cannot deliver the confirm-signup mail.
  if (/confirmation email|error sending|smtp|mailer/i.test(message)) {
    return {
      code: "AUTH_PROVIDER_FAILED",
      message: "Verification email could not be sent. Try again shortly or contact verify@picom.gg.",
    };
  }

  if (/already registered|already been registered|user already exists/i.test(message)) {
    return { code: "AUTH_INVALID_INPUT", message: "An account with this email already exists. Sign in or reset your password." };
  }

  // Unconfirmed accounts fail sign-in with a 400 too; without this branch the user is
  // wrongly told their password is wrong even when it is correct.
  if (error.code === "email_not_confirmed" || /email not confirmed|confirm your email|not been confirmed/i.test(message)) {
    return {
      code: "AUTH_PROVIDER_FAILED",
      message: "Sign-in is blocked by Auth email confirmation. Soft verification requires Confirm Email to be disabled in Supabase Auth settings.",
    };
  }

  // Missing/expired local session must never look like a wrong password.
  if (
    error.name === "AuthSessionMissingError"
    || error.code === "session_not_found"
    || /auth session missing|session missing|not authenticated|jwt expired|invalid jwt|refresh.?token/i.test(message)
  ) {
    return { code: "AUTH_SESSION_EXPIRED", message: "Your session expired. Please sign in again." };
  }

  if (status === 400 || status === 401) {
    return { code: "AUTH_INVALID_CREDENTIALS", message: "Email or password is incorrect." };
  }

  if (status === 403) {
    return { code: "AUTH_SESSION_EXPIRED", message: "Your session expired. Please sign in again." };
  }

  return { code: "AUTH_PROVIDER_FAILED", message: "Authentication failed. Please try again." };
}

function mapUser(user: User | null): AuthServiceUser | null {
  if (!user) return null;

  const displayName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null;

  return {
    id: user.id,
    email: user.email ?? null,
    displayName,
    emailVerifiedAt: user.email_confirmed_at ?? null,
    createdAt: user.created_at ?? null,
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
        createdAt: "2026-01-15T12:00:00.000Z",
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

  async signInWithEmailPassword(email: string, password: string): Promise<AuthServiceResult<AuthSignInOutcome>> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return authError("AUTH_INVALID_INPUT", "Email and password are required.");
    }

    const configured = getConfiguredClient();
    if (!configured.ok) return configured;

    if (!configured.data) {
      return { ok: true, data: { kind: "session", session: getMockSession(normalizedEmail) } };
    }

    const { data, error } = await configured.data.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      return { ok: false, error: mapSupabaseError(error) };
    }

    const session = mapSession(data.session);
    if (!session?.user) return authError("AUTH_PROVIDER_ERROR", "Supabase did not create a valid session. Please sign in again.");

    try {
      const aal = await configured.data.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!aal.error && aal.data.currentLevel === "aal1" && aal.data.nextLevel === "aal2") {
        const factors = await configured.data.auth.mfa.listFactors();
        const totp = factors.data?.totp?.find((factor) => factor.status === "verified");
        if (totp) {
          const challenge = await configured.data.auth.mfa.challenge({ factorId: totp.id });
          if (!challenge.error && challenge.data) {
            return {
              ok: true,
              data: {
                kind: "mfa_required",
                challenge: { factorId: totp.id, challengeId: challenge.data.id },
              },
            };
          }
        }
      }
    } catch {
      // MFA APIs unavailable — continue with password session.
    }

    try {
      const { data: restriction, error: restrictionError } = await configured.data.rpc("get_own_account_restriction");
      if (!restrictionError && restriction && typeof restriction === "object" && !Array.isArray(restriction)) {
        const row = restriction as { restricted?: boolean; status?: string };
        if (row.restricted === true) {
          await configured.data.auth.signOut();
          const status = typeof row.status === "string" ? row.status : "restricted";
          return authError(
            "AUTH_ACCOUNT_RESTRICTED",
            status === "disabled"
              ? "This account has been disabled by Picom operators."
              : "This account is temporarily suspended. Contact support if you need help.",
          );
        }
      }
    } catch {
      // Restriction RPC may be undeployed; do not block sign-in on missing contract.
    }

    return { ok: true, data: { kind: "session", session } };
  },

  async verifyMfaChallenge(factorId: string, challengeId: string, code: string): Promise<AuthServiceResult<AuthServiceSession>> {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      return authError("AUTH_INVALID_INPUT", "Enter the 6-digit authenticator code.");
    }
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;
    if (!configured.data) return authError("AUTH_NOT_CONFIGURED", "Supabase Auth is not configured.");

    const { error } = await configured.data.auth.mfa.verify({
      factorId,
      challengeId,
      code: trimmed,
    });
    if (error) return { ok: false, error: mapSupabaseError(error) };
    const current = await configured.data.auth.getSession();
    const mapped = mapSession(current.data.session);
    if (!mapped?.user) return authError("AUTH_PROVIDER_ERROR", "MFA verification succeeded but no session is available.");
    return { ok: true, data: mapped };
  },

  async signUpWithEmailPassword(email: string, password: string, displayName: string | undefined, acceptedLegalVersion: string): Promise<AuthServiceResult<AuthSignUpOutcome>> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return authError("AUTH_INVALID_INPUT", "Email and password are required.");
    }
    if (/@(?:steam|epic|external)\.users\.picom\.local$/i.test(normalizedEmail)) {
      return authError("AUTH_INVALID_INPUT", "This email domain is reserved for Picom sign-in providers.");
    }
    if (acceptedLegalVersion !== legalConfig.currentVersion) return authError("AUTH_INVALID_INPUT", "Accept the current Terms of Service and Privacy Notice before registering.");

    const configured = getConfiguredClient();
    if (!configured.ok) return configured;

    if (!configured.data) {
      const session = getMockSession(normalizedEmail);
      return { ok: true, data: { session, user: session.user, requiresEmailVerification: false, message: "Picom mock account created." } };
    }

    const { data, error } = await configured.data.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: appConfig.supabase.emailVerificationRedirectUrl,
        data: { ...(displayName ? { display_name: displayName } : {}), accepted_terms_version: legalConfig.termsVersion, accepted_privacy_version: legalConfig.privacyVersion },
      },
    });

    if (error) {
      return { ok: false, error: mapSupabaseError(error) };
    }

    const session = mapSession(data.session);
    const user = mapUser(data.user);
    if (!session || !user) {
      return authError(
        "AUTH_PROVIDER_ERROR",
        "Account could not be signed in automatically. Soft verification requires Confirm Email to be disabled in Supabase Auth settings.",
      );
    }

    // Soft verification email — never blocks signup/login.
    void import("./softEmailVerificationService")
      .then(({ resendSoftEmailVerification }) => resendSoftEmailVerification())
      .catch(() => undefined);

    return {
      ok: true,
      data: {
        session,
        user,
        requiresEmailVerification: false,
        message: "Picom account created and signed in.",
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
    if (error) {
      if (isRateLimitError(error)) return authError("AUTH_RATE_LIMITED", rateLimitUserMessage);
      return authError(
        "AUTH_PROVIDER_ERROR",
        "Password reset email could not be sent. Try again shortly or contact verify@picom.gg.",
      );
    }

    return {
      ok: true,
      data: {
        provider: "supabase",
        message: getPasswordResetSafeMessage(),
      },
    };
  },

  async preparePasswordRecovery(params: { code?: string; tokenHash?: string }): Promise<AuthServiceResult<{ message: string }>> {
    const { code, tokenHash } = params;
    const candidate = tokenHash ?? code;
    if (!candidate || !/^[a-zA-Z0-9._~-]{8,1024}$/.test(candidate)) return authError("AUTH_INVALID_INPUT", "This password reset link is invalid or expired.");
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;
    if (!configured.data) return { ok: true, data: { message: "Mock password recovery is ready." } };
    // token_hash uses verifyOtp (prefetch-safe, no PKCE verifier needed); code uses PKCE exchange.
    const { error } = tokenHash
      ? await configured.data.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
      : await configured.data.auth.exchangeCodeForSession(code as string);
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
    if (error) {
      if (isRateLimitError(error)) return authError("AUTH_RATE_LIMITED", rateLimitUserMessage);
      return authError(
        "AUTH_PROVIDER_ERROR",
        "Verification email could not be sent. Try again shortly or contact verify@picom.gg.",
      );
    }

    return {
      ok: true,
      data: {
        provider: "supabase",
        message: getEmailVerificationSafeMessage(),
      },
    };
  },

  async confirmEmailVerification(params: { code?: string; tokenHash?: string; type?: string }): Promise<AuthServiceResult<{ message: string; verifiedAt: string | null }>> {
    const { code, tokenHash, type } = params;
    const candidate = tokenHash ?? code;
    if (!candidate || !/^[a-zA-Z0-9._~-]{8,1024}$/.test(candidate)) return authError("AUTH_INVALID_INPUT", "This email verification link is invalid or expired.");
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;
    if (!configured.data) return { ok: true, data: { message: "Mock email verification completed.", verifiedAt: new Date().toISOString() } };
    // token_hash uses verifyOtp (prefetch-safe); code uses PKCE exchange. email_change tokens verify as that type.
    const otpType = type === "email_change" ? "email_change" : "signup";
    const { error } = tokenHash
      ? await configured.data.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
      : await configured.data.auth.exchangeCodeForSession(code as string);
    if (error) return authError("AUTH_SESSION_EXPIRED", "This email verification link is invalid or expired. Request a new one.");
    const { data, error: userError } = await configured.data.auth.getUser();
    if (userError || !data.user?.email_confirmed_at) return authError("AUTH_PROVIDER_ERROR", "Email verification could not be confirmed. Request a new link.");
    return { ok: true, data: { message: "Email address verified.", verifiedAt: data.user.email_confirmed_at } };
  },

  async establishSession(accessToken: string, refreshToken: string): Promise<AuthServiceResult<{ message: string }>> {
    if (!accessToken || !refreshToken || accessToken.length < 20 || refreshToken.length < 20) {
      return authError("AUTH_INVALID_INPUT", "Invalid session handoff.");
    }
    const configured = getConfiguredClient();
    if (!configured.ok) return configured;
    if (!configured.data) {
      return { ok: true, data: { message: "Mock session established." } };
    }
    const { data, error } = await configured.data.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error || !data.session?.user) {
      return authError("AUTH_SESSION_EXPIRED", "Could not restore your Picom session. Sign in again.");
    }
    return { ok: true, data: { message: "Signed in." } };
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

    const client = configured.data;

    // Companion (and other secondary windows) create a fresh client; wait for storage hydration
    // so an already-signed-in Main session is not reported as missing.
    // Captured before the `if (!session)` guard: inside that block TypeScript narrows
    // `session` to `null`, so `NonNullable<typeof session>` would collapse to `never`.
    type HydratedSession = NonNullable<Awaited<ReturnType<typeof client.auth.getSession>>["data"]["session"]>;
    let session = (await client.auth.getSession()).data.session;
    if (!session) {
      session = await new Promise<HydratedSession | null>((resolve) => {
        let settled = false;
        let subscription = { unsubscribe() { /* replaced below */ } };
        const finish = (value: HydratedSession | null) => {
          if (settled) return;
          settled = true;
          subscription.unsubscribe();
          globalThis.clearTimeout(timeout);
          resolve(value);
        };
        const timeout = globalThis.setTimeout(() => finish(null), 2_000);
        const listener = client.auth.onAuthStateChange((event, next) => {
          if (event === "INITIAL_SESSION" || next) finish(next);
        });
        subscription = listener.data.subscription;
        void client.auth.getSession().then(({ data: again }) => {
          if (again.session) finish(again.session);
        });
      });
    }

    if (!session?.user) {
      return { ok: true, data: null };
    }

    const { data, error } = await client.auth.getUser();
    if (error) {
      // Keep the local session identity for shell UI. Transient getUser 401/network must not
      // look like signed-out Companion ("Oturum gerekli" while Main is still logged in).
      return { ok: true, data: mapUser(session.user) };
    }

    return { ok: true, data: mapUser(data.user ?? session.user) };
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
