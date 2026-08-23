export type GoogleConsentValue = "granted" | "denied";

export type GoogleConsentState = Readonly<{
  ad_storage: GoogleConsentValue;
  analytics_storage: GoogleConsentValue;
  ad_user_data: GoogleConsentValue;
  ad_personalization: GoogleConsentValue;
}>;

export const DENIED_GOOGLE_CONSENT: GoogleConsentState = Object.freeze({
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
});

export const GRANTED_GOOGLE_CONSENT: GoogleConsentState = Object.freeze({
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
});

export const GOOGLE_ADS_CONVERSION_EVENTS = [
  "signup_cta_clicked",
  "registration_started",
  "registration_completed",
  "desktop_download_clicked",
] as const;

export type GoogleAdsConversionEvent = (typeof GOOGLE_ADS_CONVERSION_EVENTS)[number];

export type GoogleAdsConfig = Readonly<{
  id: string;
  labels: Readonly<Partial<Record<GoogleAdsConversionEvent, string>>>;
}>;

export type GoogleAdsDispatchResult =
  | "sent"
  | "duplicate"
  | "disabled"
  | "no-consent"
  | "missing-label";

type PublicEnv = Readonly<Record<string, string | boolean | undefined>>;

type GoogleTagWindow = Window & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
};

export type GoogleAdsRuntime = Readonly<{
  env: PublicEnv;
  isProduction: boolean;
  window?: GoogleTagWindow;
  document?: Document;
  storage?: Pick<Storage, "getItem" | "setItem">;
}>;

const ADS_ID_PATTERN = /^AW-\d{6,20}$/;
const CONVERSION_LABEL_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SCRIPT_ID = "picom-google-ads-tag";
const NAVIGATION_EVENT = "picom:marketing-navigation";
const REGISTRATION_COMPLETION_DEDUPLICATION_KEY = "picom.googleAds.registration_completed.v1";

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readLabel(env: PublicEnv, key: string): string | undefined {
  const label = trim(env[key]);
  return CONVERSION_LABEL_PATTERN.test(label) ? label : undefined;
}

/**
 * Google tag identifiers are public values, but invalid or absent configuration must
 * never cause a tag request. This also deliberately rejects non-numeric sample
 * identifiers instead of treating them as a production setting.
 */
export function resolveGoogleAdsConfig(env: PublicEnv): GoogleAdsConfig | null {
  const id = trim(env.VITE_GOOGLE_ADS_ID);
  if (!ADS_ID_PATTERN.test(id)) return null;

  const labels: Partial<Record<GoogleAdsConversionEvent, string>> = {
    signup_cta_clicked: readLabel(env, "VITE_GOOGLE_ADS_SIGNUP_CONVERSION_LABEL"),
    registration_started: readLabel(env, "VITE_GOOGLE_ADS_REGISTRATION_STARTED_CONVERSION_LABEL"),
    registration_completed: readLabel(env, "VITE_GOOGLE_ADS_REGISTRATION_COMPLETED_CONVERSION_LABEL"),
    desktop_download_clicked: readLabel(env, "VITE_GOOGLE_ADS_DOWNLOAD_CONVERSION_LABEL"),
  };

  // A tag without the primary outcome is not a usable PICOM production
  // configuration. Fail closed instead of loading a tag that cannot measure the
  // registration conversion.
  if (!labels.registration_completed) return null;

  return {
    id,
    labels: Object.fromEntries(
      Object.entries(labels).filter((entry): entry is [GoogleAdsConversionEvent, string] => Boolean(entry[1])),
    ),
  };
}

export function hasGrantedGoogleConsent(consent: GoogleConsentState): boolean {
  return Object.values(consent).every((value) => value === "granted");
}

function defaultRuntime(): GoogleAdsRuntime {
  const env = ((import.meta as ImportMeta & { env?: PublicEnv }).env ?? {}) as PublicEnv;
  const configuredProductionEnvironment = trim(env.VITE_APP_ENV).toLowerCase() === "production";
  return {
    env,
    isProduction: Boolean(env.PROD) && configuredProductionEnvironment,
    window: typeof window === "undefined" ? undefined : (window as GoogleTagWindow),
    document: typeof document === "undefined" ? undefined : document,
    storage: typeof sessionStorage === "undefined" ? undefined : sessionStorage,
  };
}

function safePathname(pathname: string): string {
  if (!pathname.startsWith("/")) return "/";
  return pathname.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 180) || "/";
}

/**
 * Centralized, consent-gated Google Ads integration. Components never call gtag
 * directly. The service intentionally implements basic consent mode: no Google
 * script or network request is made until the visitor explicitly grants consent.
 */
export class GoogleAdsService {
  private readonly runtime: GoogleAdsRuntime;
  private readonly config: GoogleAdsConfig | null;
  private consent: GoogleConsentState = DENIED_GOOGLE_CONSENT;
  private scriptRequested = false;
  private navigationTrackingStarted = false;
  private readonly dispatched = new Set<GoogleAdsConversionEvent>();

  constructor(runtime: GoogleAdsRuntime = defaultRuntime()) {
    this.runtime = runtime;
    this.config = runtime.isProduction ? resolveGoogleAdsConfig(runtime.env) : null;
  }

  isEnabled(): boolean {
    return this.config !== null;
  }

  setConsent(consent: GoogleConsentState): void {
    this.consent = consent;
    if (!this.config) return;

    if (hasGrantedGoogleConsent(consent)) {
      if (this.scriptRequested) {
        this.callGtag("consent", "update", consent);
        return;
      }
      this.ensureTagLoaded();
      return;
    }

    // A previously consented user can revoke consent. The loaded tag receives an
    // explicit v2 update, while new visitors never load it in the first place.
    if (this.scriptRequested) {
      this.callGtag("consent", "update", consent);
    }
  }

  dispatchConversion(event: GoogleAdsConversionEvent): GoogleAdsDispatchResult {
    if (!this.config) return "disabled";
    if (!hasGrantedGoogleConsent(this.consent)) return "no-consent";

    const label = this.config.labels[event];
    if (!label) return "missing-label";
    if (this.dispatched.has(event) || this.wasPersistentlyDispatched(event)) return "duplicate";

    this.ensureTagLoaded();
    this.callGtag("event", "conversion", { send_to: `${this.config.id}/${label}` });
    this.dispatched.add(event);
    this.markPersistentlyDispatched(event);
    return "sent";
  }

  /** Record SPA path changes without forwarding query parameters or fragments. */
  trackSpaNavigation(pathname: string): void {
    if (!this.config || !hasGrantedGoogleConsent(this.consent)) return;
    this.ensureTagLoaded();
    this.callGtag("config", this.config.id, {
      page_path: safePathname(pathname),
      send_page_view: true,
    });
  }

  /**
   * BrowserRouter uses history.pushState without a native event. One central bridge
   * keeps tracking coherent without leaking route query values to a tag provider.
   */
  startSpaNavigationTracking(): void {
    const browser = this.runtime.window;
    if (!browser || this.navigationTrackingStarted) return;
    this.navigationTrackingStarted = true;

    const trackCurrentPath = () => this.trackSpaNavigation(browser.location.pathname);
    const dispatchNavigation = () => browser.dispatchEvent(new Event(NAVIGATION_EVENT));
    const history = browser.history;
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = ((...args: Parameters<History["pushState"]>) => {
      originalPushState(...args);
      dispatchNavigation();
    }) as History["pushState"];
    history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
      originalReplaceState(...args);
      dispatchNavigation();
    }) as History["replaceState"];

    browser.addEventListener("popstate", trackCurrentPath);
    browser.addEventListener(NAVIGATION_EVENT, trackCurrentPath);
    trackCurrentPath();
  }

  private ensureTagLoaded(): void {
    if (!this.config || !hasGrantedGoogleConsent(this.consent) || this.scriptRequested) return;
    const browser = this.runtime.window;
    const document = this.runtime.document;
    if (!browser || !document?.head) return;

    this.ensureGtagQueue(browser);
    // Consent defaults must precede config/event calls. Under basic mode this happens
    // only after an affirmative choice, so no consent ping is sent on rejection.
    this.callGtag("consent", "default", DENIED_GOOGLE_CONSENT);
    this.callGtag("consent", "update", this.consent);
    this.callGtag("js", new Date());
    this.callGtag("config", this.config.id, { send_page_view: false });

    const existing = document.getElementById(SCRIPT_ID);
    if (!existing) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.config.id)}`;
      script.referrerPolicy = "strict-origin-when-cross-origin";
      // Script loading errors (including ad blockers) are deliberately non-fatal.
      script.addEventListener("error", () => undefined, { once: true });
      document.head.appendChild(script);
    }
    this.scriptRequested = true;
  }

  private ensureGtagQueue(browser: GoogleTagWindow): void {
    browser.dataLayer ??= [];
    browser.gtag ??= (...args: unknown[]) => {
      browser.dataLayer?.push(args);
    };
  }

  private callGtag(...args: unknown[]): void {
    const browser = this.runtime.window;
    if (!browser) return;
    this.ensureGtagQueue(browser);
    browser.gtag?.(...args);
  }

  /**
   * `registration_completed` is PICOM's Count=One primary action. Keep a
   * non-identifying marker in session storage so a reload, route transition,
   * retry, or a second React service instance cannot produce a second conversion
   * in the same browser session. Other event types retain per-instance protection.
   */
  private wasPersistentlyDispatched(event: GoogleAdsConversionEvent): boolean {
    if (event !== "registration_completed") return false;
    try {
      return this.runtime.storage?.getItem(REGISTRATION_COMPLETION_DEDUPLICATION_KEY) === "1";
    } catch {
      return false;
    }
  }

  private markPersistentlyDispatched(event: GoogleAdsConversionEvent): void {
    if (event !== "registration_completed") return;
    try {
      this.runtime.storage?.setItem(REGISTRATION_COMPLETION_DEDUPLICATION_KEY, "1");
    } catch {
      // Storage can be unavailable (private mode, quota, or browser policy).
      // The in-memory guard still protects re-renders in this service instance.
    }
  }
}

export const googleAds = new GoogleAdsService();
