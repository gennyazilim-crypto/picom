import {
  googleAds,
  type GoogleAdsConversionEvent,
  type GoogleAdsDispatchResult,
} from "./googleAds";

export const MARKETING_EVENT_NAMES = [
  "marketing_landing_view",
  "signup_cta_clicked",
  "registration_started",
  "registration_completed",
  "desktop_download_clicked",
] as const;

export type MarketingEventName = (typeof MARKETING_EVENT_NAMES)[number];

/**
 * Internal funnel names and Google Ads actions are deliberately distinct. The
 * account-side primary/secondary choice is made in Google Ads; this map only says
 * which internal events are eligible to use an explicitly configured label.
 */
export const GOOGLE_ADS_CONVERSION_FOR_MARKETING_EVENT: Readonly<
  Partial<Record<MarketingEventName, GoogleAdsConversionEvent>>
> = Object.freeze({
  signup_cta_clicked: "signup_cta_clicked",
  registration_started: "registration_started",
  registration_completed: "registration_completed",
  desktop_download_clicked: "desktop_download_clicked",
});

/**
 * Marketing events deliberately have no metadata. This makes it impossible for a
 * caller to send identifiers, message content, or form values to Google Ads.
 */
export function sanitizeMarketingPayload(_payload: unknown): Readonly<Record<string, never>> {
  return Object.freeze({});
}

export function trackMarketingEvent(
  name: MarketingEventName,
): GoogleAdsDispatchResult | "not-a-conversion" {
  sanitizeMarketingPayload(undefined);
  if (name === "marketing_landing_view") {
    if (typeof window !== "undefined") googleAds.trackSpaNavigation(window.location.pathname);
    return "not-a-conversion";
  }
  const conversion = GOOGLE_ADS_CONVERSION_FOR_MARKETING_EVENT[name];
  if (!conversion) return "not-a-conversion";
  return googleAds.dispatchConversion(conversion);
}
