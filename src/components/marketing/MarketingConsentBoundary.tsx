import { useEffect, useState, type ReactNode } from "react";
import {
  DENIED_GOOGLE_CONSENT,
  GRANTED_GOOGLE_CONSENT,
  googleAds,
} from "../../services/marketing/googleAds";
import { trackMarketingEvent } from "../../services/marketing/marketingEvents";

const CONSENT_STORAGE_KEY = "picom.marketing.consent.v1";
const OPEN_SETTINGS_EVENT = "picom:marketing-consent-open";
type MarketingConsentChoice = "granted" | "denied";

function getCookieChoice(): MarketingConsentChoice | null {
  if (typeof document === "undefined") return null;
  const encoded = encodeURIComponent(CONSENT_STORAGE_KEY);
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${encoded}=`))
    ?.slice(encoded.length + 1);
  return value === "granted" || value === "denied" ? value : null;
}

function getChoice(): MarketingConsentChoice | null {
  const cookieChoice = getCookieChoice();
  if (cookieChoice) return cookieChoice;
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    return null;
  }
}

function persistChoice(choice: MarketingConsentChoice): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Cookie storage below remains the cross-subdomain persistence path.
  }
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const onPicomDomain = window.location.hostname === "picom.gg" || window.location.hostname.endsWith(".picom.gg");
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domain = onPicomDomain ? "; Domain=.picom.gg" : "";
  document.cookie = `${encodeURIComponent(CONSENT_STORAGE_KEY)}=${choice}; Path=/${domain}; SameSite=Lax${secure}; Max-Age=31536000`;
}

function applyChoice(choice: MarketingConsentChoice | null): void {
  googleAds.setConsent(choice === "granted" ? GRANTED_GOOGLE_CONSENT : DENIED_GOOGLE_CONSENT);
}

/** Opens the same choice UI after the user has dismissed it. */
export function openMarketingConsentSettings(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}

/**
 * Basic Consent Mode v2 UI for Account Center. The live marketing-site CMP is
 * maintained in a separate repository, so this component never attempts to replace
 * it. Both choices are equally available and all Google purposes move together.
 */
export function MarketingConsentBoundary({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<MarketingConsentChoice | null>(() => getChoice());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    applyChoice(choice);
    googleAds.startSpaNavigationTracking();
    trackMarketingEvent("marketing_landing_view");
  }, [choice]);

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, []);

  const choose = (next: MarketingConsentChoice) => {
    persistChoice(next);
    setChoice(next);
    setSettingsOpen(false);
  };

  const isOpen = choice === null || settingsOpen;
  return (
    <>
      {children}
      {isOpen ? (
        <section className="picom-marketing-consent" aria-label="Cookie and measurement choices">
          <div className="picom-marketing-consent__content">
            <h2>Cookie choices</h2>
            <p>
              Necessary storage keeps sign-in working. Optional Google Ads measurement is off unless you allow it. When enabled,
              all Google Consent Mode v2 purposes—ad storage, analytics storage, ad user data, and ad personalization—are allowed together.
            </p>
            <p>
              <a href="https://picom.gg/privacy">Privacy Policy</a>
              {" · "}
              <a href="https://picom.gg/cookies">Cookie Policy</a>
            </p>
          </div>
          <div className="picom-marketing-consent__actions">
            <button type="button" onClick={() => choose("denied")}>Necessary only</button>
            <button type="button" onClick={() => choose("granted")}>Allow optional measurement</button>
          </div>
        </section>
      ) : null}
    </>
  );
}
