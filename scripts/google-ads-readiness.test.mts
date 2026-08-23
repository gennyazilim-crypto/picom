import assert from "node:assert/strict";
import {
  DENIED_GOOGLE_CONSENT,
  GRANTED_GOOGLE_CONSENT,
  GoogleAdsService,
  resolveGoogleAdsConfig,
  type GoogleAdsRuntime,
} from "../src/services/marketing/googleAds.ts";
import {
  ATTRIBUTION_TTL_MS,
  captureAttributionFromLocation,
  parseAttribution,
  type AttributionStorage,
} from "../src/services/marketing/attribution.ts";

type FakeScript = {
  id: string;
  async: boolean;
  src: string;
  referrerPolicy: string;
  addEventListener: () => void;
};

function createRuntime(
  env: Record<string, string | boolean | undefined>,
  isProduction = true,
  storage?: GoogleAdsRuntime["storage"],
): { runtime: GoogleAdsRuntime; commands: unknown[][]; scripts: FakeScript[] } {
  const commands: unknown[][] = [];
  const scripts: FakeScript[] = [];
  const browser = {
    dataLayer: commands,
    location: { pathname: "/register" },
  } as unknown as Window;
  const document = {
    head: {
      appendChild(script: FakeScript) {
        scripts.push(script);
        return script;
      },
    },
    getElementById(id: string) {
      return scripts.find((script) => script.id === id) ?? null;
    },
    createElement() {
      return {
        id: "",
        async: false,
        src: "",
        referrerPolicy: "",
        addEventListener: () => undefined,
      } as FakeScript;
    },
  } as unknown as Document;

  return {
    runtime: { env, isProduction, window: browser, document, storage },
    commands,
    scripts,
  };
}

function createStorage(): AttributionStorage {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const configuredEnv = {
  VITE_APP_ENV: "production",
  VITE_GOOGLE_ADS_ID: "AW-1234567890",
  VITE_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL: "signup_label",
  VITE_GOOGLE_ADS_REGISTRATION_STARTED_CONVERSION_LABEL: "registration_start_label",
  VITE_GOOGLE_ADS_REGISTRATION_COMPLETED_CONVERSION_LABEL: "registration_complete_label",
  VITE_GOOGLE_ADS_DOWNLOAD_CONVERSION_LABEL: "download_label",
};

// Consent denied: no script, no conversion, no provider call.
{
  const { runtime, commands, scripts } = createRuntime(configuredEnv);
  const service = new GoogleAdsService(runtime);
  service.setConsent(DENIED_GOOGLE_CONSENT);
  assert.equal(service.dispatchConversion("registration_completed"), "no-consent");
  assert.equal(scripts.length, 0);
  assert.equal(commands.length, 0);
}

// Consent granted: the configured conversion may fire once, with only send_to.
{
  const { runtime, commands, scripts } = createRuntime(configuredEnv);
  const service = new GoogleAdsService(runtime);
  service.setConsent(GRANTED_GOOGLE_CONSENT);
  assert.equal(service.dispatchConversion("registration_completed"), "sent");
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=AW-1234567890");
  const conversion = commands.find((command) => command[0] === "event" && command[1] === "conversion");
  assert.deepEqual(conversion, ["event", "conversion", { send_to: "AW-1234567890/registration_complete_label" }]);
  assert.deepEqual(Object.keys((conversion?.[2] ?? {}) as object), ["send_to"]);
  assert.doesNotMatch(
    JSON.stringify(conversion),
    /person@example\.com|not-retained|192\.0\.2\.1|raw-user-id/i,
  );
  assert.equal(service.dispatchConversion("registration_completed"), "duplicate");
  assert.equal(commands.filter((command) => command[0] === "event" && command[1] === "conversion").length, 1);
  service.setConsent(DENIED_GOOGLE_CONSENT);
  assert.deepEqual(commands.at(-1), ["consent", "update", DENIED_GOOGLE_CONSENT]);
  assert.equal(service.dispatchConversion("registration_started"), "no-consent");
  service.setConsent(GRANTED_GOOGLE_CONSENT);
  assert.deepEqual(commands.at(-1), ["consent", "update", GRANTED_GOOGLE_CONSENT]);
}

// The primary action persists an opaque, session-only marker. It therefore cannot
// duplicate after a re-render/retry, route transition, refresh, or StrictMode's
// recreated service instance during the same browser session.
{
  const storage = createStorage();
  const first = createRuntime(configuredEnv, true, storage);
  const firstService = new GoogleAdsService(first.runtime);
  firstService.setConsent(GRANTED_GOOGLE_CONSENT);
  assert.equal(firstService.dispatchConversion("registration_completed"), "sent");

  const recreated = createRuntime(configuredEnv, true, storage);
  const recreatedService = new GoogleAdsService(recreated.runtime);
  recreatedService.setConsent(GRANTED_GOOGLE_CONSENT);
  assert.equal(recreatedService.dispatchConversion("registration_completed"), "duplicate");
  assert.equal(
    recreated.commands.filter((command) => command[0] === "event" && command[1] === "conversion").length,
    0,
  );
}

// Missing, incomplete, or sample-looking configuration fails closed without an application crash.
{
  const { runtime, scripts } = createRuntime({ VITE_GOOGLE_ADS_ID: "AW-XXXXXXXXX" });
  const service = new GoogleAdsService(runtime);
  service.setConsent(GRANTED_GOOGLE_CONSENT);
  assert.equal(service.dispatchConversion("registration_completed"), "disabled");
  assert.equal(scripts.length, 0);
  assert.equal(resolveGoogleAdsConfig({ VITE_GOOGLE_ADS_ID: "AW-XXXXXXXXX" }), null);
  assert.equal(resolveGoogleAdsConfig({ VITE_GOOGLE_ADS_ID: "AW-1234567890" }), null);
}

// Development/test never sends a production conversion even if identifiers exist.
{
  const { runtime, scripts } = createRuntime(configuredEnv, false);
  const service = new GoogleAdsService(runtime);
  service.setConsent(GRANTED_GOOGLE_CONSENT);
  assert.equal(service.dispatchConversion("signup_cta_clicked"), "disabled");
  assert.equal(scripts.length, 0);
}

// UTM parsing is bounded and drops control characters, non-allowlisted characters,
// email-shaped values, and unknown keys.
{
  const attribution = parseAttribution("?utm_source=google&utm_campaign=summer%00sale&utm_content=%3Cscript%3E&utm_term=person%40example.com&unknown=x&gclid=EAIaIQ");
  assert.deepEqual(attribution, { utm_source: "google", gclid: "EAIaIQ" });
}

// Attribution survives the sign-up handoff within its session, is never widened to
// arbitrary query values, and expires after its documented TTL.
{
  const storage = createStorage();
  const captured = captureAttributionFromLocation(
    "?utm_source=google&utm_medium=cpc&utm_campaign=summer_2026&utm_content=banner_1&utm_term=picom&gclid=EAIaIQ&gbraid=GB_1&wbraid=WB_1",
    { storage, now: 1_000 },
  );
  assert.deepEqual(captured, {
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "summer_2026",
    utm_content: "banner_1",
    utm_term: "picom",
    gclid: "EAIaIQ",
    gbraid: "GB_1",
    wbraid: "WB_1",
  });
  assert.deepEqual(captureAttributionFromLocation("", { storage, now: 1_000 + ATTRIBUTION_TTL_MS - 1 }), captured);
  assert.deepEqual(captureAttributionFromLocation("", { storage, now: 1_000 + ATTRIBUTION_TTL_MS }), {});
}

// The central conversion command admits only send_to, so identifiers and form data
// cannot be serialized into a Google Ads payload.

console.log("GOOGLE_ADS_READINESS_TEST=PASS");
