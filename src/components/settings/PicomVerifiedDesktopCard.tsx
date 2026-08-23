import { useCallback, useEffect, useState } from "react";
import { accountCenterUrls } from "../../config/accountCenterUrls";
import { translateSettings } from "../../services/settings/settingsI18n";
import type { UiLanguage } from "../../services/settingsService";
import { picomVerifiedService } from "../../services/verificationBusiness/picomVerifiedService";
import {
  readVerifiedEntitlementCache,
  writeVerifiedEntitlementCache,
} from "../../services/verificationBusiness/verifiedEntitlementCache";
import type { PicomVerifiedPublicSummary } from "../../types/verificationBusiness/picomVerified";
import { isAllowedVerifiedExternalUrl } from "../../services/desktop/verifiedExternalUrlAllowlist";
import * as externalLinkService from "../../services/desktop/externalLinkService";
import { getSupabaseClient } from "../../services/supabase/supabaseClient";

export type PicomVerifiedDesktopCardProps = Readonly<{
  language: UiLanguage;
  onOpenAccountCenter: (url: string) => void;
}>;

export function PicomVerifiedDesktopCard({ language, onOpenAccountCenter }: PicomVerifiedDesktopCardProps) {
  const t = (key: Parameters<typeof translateSettings>[0]) => translateSettings(key, language);
  const [userId, setUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PicomVerifiedPublicSummary | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    void client.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    setError(null);
    const result = await picomVerifiedService.getSummary();
    if (result.ok) {
      setSummary(result.data);
      writeVerifiedEntitlementCache(userId, result.data);
      setFromCache(false);
    } else {
      const cached = readVerifiedEntitlementCache(userId);
      if (cached) {
        setSummary({
          subscriptionStatus: cached.subscriptionStatus as PicomVerifiedPublicSummary["subscriptionStatus"],
          planKey: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          entitlements: {
            adFree: cached.adFree,
            verifiedBadgeEligible: cached.verifiedBadgeEligible,
            prioritySupport: cached.prioritySupport,
          },
          verificationDisplayState: cached.verificationDisplayState,
          badgeDisplayState: cached.badgeDisplayState,
          customerPortalAvailable: false,
        });
        setFromCache(true);
      }
      setError(result.error.message);
    }
    setRefreshing(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const client = getSupabaseClient();
    if (!client) return;
    const channel = client
      .channel(`picom-verified-entitlements:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "account_entitlements", filter: `subject_id=eq.${userId}` },
        () => {
          void refresh();
        },
      )
      .subscribe();
    const poll = window.setInterval(() => {
      void refresh();
    }, 120_000);
    return () => {
      window.clearInterval(poll);
      void client.removeChannel(channel);
    };
  }, [userId, refresh]);

  const openSafe = async (url: string) => {
    if (!isAllowedVerifiedExternalUrl(url)) {
      setError(t("verified.unsafeUrl"));
      return;
    }
    if (url.startsWith(accountCenterUrls.origin)) {
      onOpenAccountCenter(url);
      return;
    }
    const opened = await externalLinkService.openExternalUrl(url);
    if (!opened.ok) setError(externalLinkService.getUserFriendlyError(opened.reason));
  };

  const openPortal = async () => {
    const result = await picomVerifiedService.createPortal("/account/billing");
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    await openSafe(result.data.portalUrl);
  };

  return (
    <section className="account-settings-section" id="settings-account-verified" aria-label={t("verified.title")}>
      <h3 className="account-settings-section-title">{t("verified.title")}</h3>
      <div className="settings-status-card settings-feature-card">
        <small>{t("verified.help")}</small>
        {summary ? (
          <dl className="account-summary-meta">
            <div><dt>{t("verified.subscription")}</dt><dd>{summary.subscriptionStatus}</dd></div>
            <div><dt>{t("verified.adFree")}</dt><dd>{summary.entitlements.adFree ? t("verified.active") : t("verified.inactive")}</dd></div>
            <div><dt>{t("verified.verification")}</dt><dd>{summary.verificationDisplayState}</dd></div>
            <div><dt>{t("verified.badge")}</dt><dd>{summary.badgeDisplayState}</dd></div>
          </dl>
        ) : (
          <small>{refreshing ? t("verified.refreshing") : t("verified.unavailable")}</small>
        )}
        {fromCache ? <small>{t("verified.cached")}</small> : null}
        {error ? <small role="status">{error}</small> : null}
        <div className="settings-actions-row settings-actions-row--wrap">
          <button type="button" className="settings-inline-action" onClick={() => onOpenAccountCenter(accountCenterUrls.verified)}>
            {t("verified.manageWeb")}
          </button>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => onOpenAccountCenter(accountCenterUrls.accountVerification)}>
            {t("verified.completeVerification")}
          </button>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={!summary?.customerPortalAvailable} onClick={() => void openPortal()}>
            {t("verified.billingPortal")}
          </button>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={refreshing} onClick={() => void refresh()}>
            {refreshing ? t("verified.refreshing") : t("verified.refresh")}
          </button>
        </div>
      </div>
    </section>
  );
}
