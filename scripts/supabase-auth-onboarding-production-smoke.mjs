import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(path), "utf8");
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const expectIncludes = (source, marker, message) => expect(source.includes(marker), message);

const auth = read("src/services/authService.ts");
const sessionHook = read("src/hooks/useProtectedDesktopSession.ts");
const registerScreen = read("src/components/RegisterScreen.tsx");
const app = read("src/App.tsx");
const onboarding = read("src/services/onboarding/onboardingService.ts");
const settings = read("src/services/settingsService.ts");
const socialAuth = read("src/services/auth/socialAuthService.ts");
const migration = read("supabase/migrations/20260711150900_auth_profile_onboarding_production.sql");
const allMigrations = readdirSync(resolve("supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .map((name) => read(`supabase/migrations/${name}`))
  .join("\n");

expectIncludes(auth, "AuthSignUpOutcome", "Signup must expose a verification-aware outcome.");
expectIncludes(auth, "requiresEmailVerification: false", "Canonical signup must not block on email verification after a real session.");
expectIncludes(auth, "Soft verification requires Confirm Email", "Signup must fail closed when Supabase does not return an authenticated session.");
expectIncludes(auth, "softEmailVerificationService", "Soft verification email must remain fire-and-forget and never gate login.");
expectIncludes(auth, "never blocks signup/login", "Soft verification must remain non-blocking.");
expect(!auth.includes("requiresEmailVerification: !session"), "Signup must not treat a missing session as a successful verification-only outcome.");
expect(!auth.includes("mapSession(data.session) ?? getMockSession"), "Supabase sign-in must never fall back to a mock session.");
expectIncludes(auth, ".auth.refreshSession()", "Session restore must refresh an expiring session.");
expectIncludes(auth, ".auth.getUser()", "Session restore must validate the current user with Supabase.");
expectIncludes(auth, "signOut({ scope: \"local\" })", "Invalid or revoked local sessions must be cleared safely.");
expectIncludes(sessionHook, "setSession(result.data.session)", "Registration must not authenticate an email-verification-only result.");
expectIncludes(sessionHook, "setNotice(result.data.message)", "Registration must expose its safe completion state.");
expectIncludes(registerScreen, 'className="auth-success"', "Register screen must render a non-error verification notice.");

const firstLaunchGuard = app.indexOf("if (!safeMode.active && !firstLaunchSetup.completed)");
const authLoadingGuard = app.indexOf("Restoring your Picom session");
const authGuard = app.indexOf('guestAuthView === "register"');
const legalGuard = app.indexOf("<TermsReacceptPrompt");
const onboardingView = app.indexOf("<OnboardingFlow");
// Device first-run, session restore, signed-out login, legal acceptance, then
// account onboarding. A refresh must not flash login or skip legal.
expect(
  firstLaunchGuard >= 0
    && authLoadingGuard > firstLaunchGuard
    && authGuard > authLoadingGuard
    && legalGuard > authGuard
    && onboardingView > legalGuard,
  "First launch, auth-loading, signed-out, legal, and onboarding guards must remain separated and ordered.",
);

expectIncludes(onboarding, 'client.rpc("complete_current_user_onboarding"', "Supabase onboarding must use the transactional service boundary.");
expect(!onboarding.includes("if (localRecord) return"), "Supabase onboarding must not use local state as authority.");
expectIncludes(onboarding, "client.from(\"user_follows\")", "Supabase onboarding state must restore persisted follows.");
expectIncludes(settings, "theme_mode: accountSettings.appearanceSettings.themeMode", "Theme preference must sync to the account.");
expectIncludes(settings, 'select("schema_version,theme_mode,preferred_locale,preferred_locale_mode,notification_settings")', "Theme preference must hydrate after session restore.");

for (const marker of [
  "security definer",
  "actor_id uuid := auth.uid()",
  "perform public.follow_user(candidate_user_id)",
  "onboarding_completed = true",
  "theme_mode",
  "revoke all on function public.complete_current_user_onboarding",
  "grant execute on function public.complete_current_user_onboarding",
]) expectIncludes(migration.toLowerCase(), marker.toLowerCase(), `Onboarding migration is missing: ${marker}`);

expect(/auth\.users[\s\S]+profiles|profiles[\s\S]+auth\.users/i.test(allMigrations), "Profile provisioning must remain linked to Supabase Auth users.");
expectIncludes(socialAuth, "source.isSupabase", "Social auth must remain disabled outside configured Supabase mode.");
expectIncludes(socialAuth, "externalLinkService.openExternalUrl", "OAuth must use the safe desktop external-link boundary.");
expectIncludes(socialAuth, "exchangeCodeForSession", "OAuth callback must exchange PKCE code through Supabase Auth.");

console.log("Supabase Auth profile and onboarding production contract passed.");
