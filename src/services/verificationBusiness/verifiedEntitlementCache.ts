import type { PicomVerifiedPublicSummary } from "../../types/verificationBusiness/picomVerified";

const CACHE_KEY = "picom.verified.entitlement_cache.v1";
/** Short offline cache — never grant infinite ad-free offline. */
const MAX_CACHE_MS = 15 * 60 * 1000;

export type VerifiedEntitlementCache = Readonly<{
  userId: string;
  adFree: boolean;
  verifiedBadgeEligible: boolean;
  prioritySupport: boolean;
  subscriptionStatus: string;
  badgeDisplayState: string;
  verificationDisplayState: string;
  cachedAt: string;
  expiresAt: string;
}>;

export function writeVerifiedEntitlementCache(userId: string, summary: PicomVerifiedPublicSummary, now = Date.now()): void {
  const payload: VerifiedEntitlementCache = {
    userId,
    adFree: summary.entitlements.adFree,
    verifiedBadgeEligible: summary.entitlements.verifiedBadgeEligible,
    prioritySupport: summary.entitlements.prioritySupport,
    subscriptionStatus: summary.subscriptionStatus,
    badgeDisplayState: summary.badgeDisplayState,
    verificationDisplayState: summary.verificationDisplayState,
    cachedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + MAX_CACHE_MS).toISOString(),
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function readVerifiedEntitlementCache(userId: string, now = Date.now()): VerifiedEntitlementCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VerifiedEntitlementCache;
    if (parsed.userId !== userId) return null;
    if (Date.parse(parsed.expiresAt) <= now) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearVerifiedEntitlementCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
