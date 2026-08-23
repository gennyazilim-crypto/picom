import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const memory = new Map();
const localStorage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); },
};
globalThis.window = { localStorage };

const {
  canonicalizeAuthErrorCode,
  authErrorFallbackMessage,
  isAuthErrorCode,
} = await import("../src/services/auth/authErrorMap.ts");
const {
  createSocialAuthCallbackState,
  consumeSocialAuthCallbackState,
  buildSocialGatewayCallbackUrl,
} = await import("../src/services/auth/socialAuthCallbackState.ts");
const { parseDeepLink } = await import("../src/services/deepLinkService.ts");
const { canUnlinkProvider } = await import("../src/services/auth/loginMethodGuards.ts");
const { beginAuthAttempt, finishAuthAttempt, getAuthAttempt } = await import("../src/services/auth/authAttemptStore.ts");
const {
  AUTH_GATEWAY_LIVE_PATHS,
  isAllowedAuthGatewayRedirect,
  isLiveAuthGatewayPath,
  buildCanonicalSteamOpenIdStartUrl,
} = await import("../services/auth-gateway/route-contract.mjs");

function read(path) {
  return readFileSync(path, "utf8");
}

// Email / taxonomy
assert.equal(canonicalizeAuthErrorCode("AUTH_INVALID_CREDENTIALS"), "AUTH_INVALID_CREDENTIALS");
assert.equal(canonicalizeAuthErrorCode("AUTH_PROVIDER_ERROR"), "AUTH_PROVIDER_FAILED");
assert.equal(canonicalizeAuthErrorCode("AUTH_SESSION_EXPIRED"), "AUTH_SESSION_FAILED");
assert.equal(isAuthErrorCode("AUTH_RATE_LIMITED"), true);
assert.match(authErrorFallbackMessage("AUTH_INVALID_CREDENTIALS"), /incorrect/i);
assert.match(authErrorFallbackMessage("AUTH_NETWORK_ERROR"), /connection/i);
assert.match(authErrorFallbackMessage("AUTH_CANCELLED"), /cancelled/i);
assert.equal(authErrorFallbackMessage("not-a-code"), authErrorFallbackMessage("AUTH_PROVIDER_FAILED"));

const authService = read("src/services/authService.ts");
assert.match(authService, /signInWithPassword/);
assert.match(authService, /signUp\(/);
assert.match(authService, /resetPasswordForEmail/);
assert.match(authService, /AUTH_INVALID_CREDENTIALS/);
assert.match(authService, /AUTH_NETWORK_ERROR/);
assert.match(authService, /AUTH_ACCOUNT_DISABLED/);
assert.doesNotMatch(authService, /service_role/i);

// Google / callback state
const googleState = createSocialAuthCallbackState("google", "sign-in");
assert.match(googleState, /^[A-Za-z0-9_-]{32,128}$/);
assert.equal(buildSocialGatewayCallbackUrl("google", googleState), `https://auth.picom.gg/google/callback?state=${encodeURIComponent(googleState)}`);
const consumed = consumeSocialAuthCallbackState({ state: googleState, provider: "google" });
assert.equal(consumed.ok, true);
if (consumed.ok) assert.equal(consumed.purpose, "sign-in");
assert.equal(consumeSocialAuthCallbackState({ state: googleState, provider: "google" }).ok, false);
assert.equal(consumeSocialAuthCallbackState({ state: googleState, provider: "steam" }).ok, false);

const social = read("src/services/auth/socialAuthService.ts");
assert.match(social, /signInWithOAuth/);
assert.match(social, /buildGoogleGatewayStartUrl/);
assert.match(social, /auth\.picom\.gg/);
assert.match(social, /exchangeCodeForSession/);
assert.match(social, /beginAuthAttempt/);
assert.match(social, /AUTH_IDENTITY_ALREADY_LINKED/);
assert.doesNotMatch(social, /VITE_.*SECRET/);
assert.doesNotMatch(social, /SERVICE_ROLE/);

// Epic / Steam
const steamState = createSocialAuthCallbackState("steam", "sign-in");
const epicState = createSocialAuthCallbackState("epic", "link");
assert.equal(consumeSocialAuthCallbackState({ state: steamState, provider: "steam" }).ok, true);
assert.equal(consumeSocialAuthCallbackState({ state: steamState, provider: "steam" }).ok, false);
const epicConsumed = consumeSocialAuthCallbackState({ state: epicState, provider: "epic" });
assert.equal(epicConsumed.ok, true);
if (epicConsumed.ok) assert.equal(epicConsumed.purpose, "link");

assert.match(social, /beginCustomOAuth/);
assert.match(social, /completeCustomOAuthCallback/);
assert.match(social, /action=exchange&nonce=/);
assert.match(social, /authGatewayUrl/);
assert.match(social, /\/\$\{provider\}\/start\?nonce=/);
assert.doesNotMatch(social, /hardcoded SteamID|7656119/);

const steamStart = buildCanonicalSteamOpenIdStartUrl(steamState);
assert.match(steamStart.url, /^https:\/\/steamcommunity\.com\/openid\/login\?/);
assert.equal(steamStart.realm, "https://auth.picom.gg/");
assert.match(steamStart.returnTo, /^https:\/\/auth\.picom\.gg\/steam\/callback\?nonce=/);

for (const path of ["/google/start", "/google/callback", "/epic/start", "/epic/callback", "/steam/start", "/steam/callback", "/health"]) {
  assert.equal(isLiveAuthGatewayPath(path), true, path);
}
assert.equal(AUTH_GATEWAY_LIVE_PATHS.includes("/google/callback"), true);
assert.equal(isAllowedAuthGatewayRedirect("picom://auth/callback"), true);
assert.equal(isAllowedAuthGatewayRedirect("https://evil.example/callback"), false);

const gateway = read("services/auth-gateway/index.mjs");
assert.match(gateway, /handleGoogleStart/);
assert.match(gateway, /handleGoogleCallback/);
assert.match(gateway, /handleEpicStart/);
assert.match(gateway, /handleSteamCallback/);
assert.match(gateway, /buildDesktopAuthCallback/);
assert.match(gateway, /picom:\/\/auth\/callback/);
assert.doesNotMatch(gateway, /SUPABASE_SERVICE_ROLE_KEY/);

// Account linking / last method
assert.equal(canUnlinkProvider({ hasPassword: true, linkedProviders: ["steam"] }, "steam").ok, true);
assert.equal(canUnlinkProvider({ hasPassword: false, linkedProviders: ["steam"] }, "steam").ok, false);
assert.equal(canUnlinkProvider({ hasPassword: false, linkedProviders: ["google"] }, "steam").ok, false);
assert.match(social, /beginProviderLink/);
assert.match(social, /unlinkProvider/);
assert.match(read("src/components/settings/AccountSummarySection.tsx"), /onConnectProvider/);
assert.match(read("src/components/settings/AccountSummarySection.tsx"), /onDisconnectProvider/);

// Electron deep links
const validGoogle = `picom://auth/callback?provider=google&state=${googleState}&code=abcdefghijklmnop`;
const validSteam = `picom://auth/callback?provider=steam&state=${steamState}&exchange=${steamState}`;
const cancelled = `picom://auth/callback?provider=google&state=${googleState}&error=AUTH_CANCELLED`;
assert.equal(parseDeepLink(validGoogle).ok, true);
assert.equal(parseDeepLink(validSteam).ok, true);
assert.equal(parseDeepLink(cancelled).ok, true);
assert.equal(parseDeepLink("picom://auth/open").ok, true);
assert.equal(parseDeepLink("https://evil.example/callback").ok, false);
assert.equal(parseDeepLink("picom://auth/callback?code=abcdefgh").ok, false);
assert.equal(parseDeepLink("picom://auth/callback?provider=google&state=short&code=abcdefghijklmnop").ok, false);
assert.equal(parseDeepLink("picom://secret/callback").ok, false);

const parsedGoogle = parseDeepLink(validGoogle);
assert.equal(parsedGoogle.ok, true);
if (parsedGoogle.ok) {
  assert.equal(parsedGoogle.action.type, "authCallback");
  if (parsedGoogle.action.type === "authCallback") {
    assert.equal(parsedGoogle.action.provider, "google");
    assert.equal(parsedGoogle.action.code, "abcdefghijklmnop");
  }
}
const parsedMalformed = parseDeepLink("picom://auth/callback?provider=google&state=abc&code=x");
assert.equal(parsedMalformed.ok, false);
const parsedOpen = parseDeepLink("picom://auth/open");
assert.equal(parsedOpen.ok, true);

const main = read("electron/main.cts");
assert.match(main, /app\.setAsDefaultProtocolClient\("picom"/);
assert.match(main, /app\.on\("second-instance"/);
assert.match(main, /app\.on\("open-url"/);
assert.match(main, /isAuthOpenDeepLink/);
assert.match(read("electron/ipcPayloadValidation.cts"), /segments\[0\] === "open"/);
assert.match(read("electron/preload.cts"), /segments\[0\] === "open"/);
assert.match(read("electron/main.cts"), /contextIsolation: true/);
assert.match(read("electron/main.cts"), /nodeIntegration: false/);
assert.match(read("electron/main.cts"), /sandbox: true/);

// Attempt store
beginAuthAttempt("google", "sign-in");
assert.equal(getAuthAttempt()?.provider, "google");
finishAuthAttempt("google");
assert.equal(getAuthAttempt(), null);

// UI contract
const login = read("src/components/LoginScreen.tsx");
assert.match(login, /login\.subtitle/);
assert.match(login, /onCreateAccount/);
assert.match(login, /onForgotPassword/);
assert.match(login, /SocialLoginButtons/);
assert.match(read("src/components/auth/SocialLoginButtons.tsx"), /Connecting to Google|social\.connectingGoogle/);
assert.match(read("src/components/auth/ForgotPasswordScreen.tsx"), /requestPasswordReset/);
assert.match(read("src/components/RegisterScreen.tsx"), /signUp|onSubmit/);
assert.match(read("src/App.tsx"), /guestAuthView/);

console.log("auth-v2 contract tests passed");
