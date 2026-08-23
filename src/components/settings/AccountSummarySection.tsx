import type { SocialAuthProvider, SocialProviderAccountState } from "../../services/auth/socialAuthService";
import { accountCenterUrls } from "../../config/accountCenterUrls";
import { translateSettings } from "../../services/settings/settingsI18n";
import type { UiLanguage } from "../../services/settingsService";
import { UserAvatar } from "../UserAvatar";
import { PicomVerifiedDesktopCard } from "./PicomVerifiedDesktopCard";

function maskEmail(email: string | null | undefined): string {
  const value = String(email || "").trim();
  if (!value.includes("@")) return "—";
  const [local, domain] = value.split("@");
  if (!domain) return "—";
  const head = (local || "*").slice(0, 1);
  return `${head}***@${domain}`;
}

function providerStatusLabel(provider: SocialProviderAccountState, language: UiLanguage): string {
  if (provider.linked) return translateSettings("provider.connected", language);
  if (provider.available) return translateSettings("provider.notConnected", language);
  return provider.reason || translateSettings("provider.unavailable", language);
}

export type AccountSummarySectionProps = Readonly<{
  language: UiLanguage;
  userId?: string | null;
  displayName: string;
  username: string;
  email: string | null;
  emailVerifiedAt: string | null;
  avatarUrl?: string | null;
  memberSinceLabel: string;
  planLabel: string;
  accountStatusLabel: string;
  socialProviders: readonly SocialProviderAccountState[];
  socialProviderBusy?: SocialAuthProvider | null;
  onConnectProvider?: (provider: SocialAuthProvider) => void;
  onDisconnectProvider?: (provider: SocialAuthProvider) => void;
  onOpenAccountCenter: (url: string) => void;
  onOpenPublisherApply?: () => void;
  onOpenPublisherDashboard?: () => void;
  onLogout: () => void;
  onRefreshIdentity: () => void;
  identityRefreshing: boolean;
}>;

function formatAccountStatus(status: string, language: UiLanguage): string {
  const map: Record<string, Parameters<typeof translateSettings>[0]> = {
    online: "presence.online",
    idle: "presence.idle",
    busy: "presence.busy",
    offline: "presence.offline",
  };
  const key = map[status.toLowerCase()];
  return key ? translateSettings(key, language) : status;
}

export function AccountSummarySection({
  language,
  userId,
  displayName,
  username,
  email,
  emailVerifiedAt,
  avatarUrl,
  memberSinceLabel,
  planLabel,
  accountStatusLabel,
  socialProviders,
  socialProviderBusy = null,
  onConnectProvider,
  onDisconnectProvider,
  onOpenAccountCenter,
  onOpenPublisherApply,
  onOpenPublisherDashboard,
  onLogout,
  onRefreshIdentity,
  identityRefreshing,
}: AccountSummarySectionProps) {
  const t = (key: Parameters<typeof translateSettings>[0], params?: Record<string, string | number>) =>
    translateSettings(key, language, params);
  const softVerify = emailVerifiedAt
    ? t("account.emailVerified", { when: emailVerifiedAt })
    : t("account.emailPending");
  const identityLabel = displayName || username || "?";

  return (
    <div className="account-settings-stack" id="settings-account-summary">
      <p className="settings-section-description">{t("account.summaryDescription")}</p>

      <section className="account-settings-section" aria-label={t("account.centerTitle")}>
        <div className="settings-status-card settings-feature-card account-summary-card">
          <div className="account-summary-identity">
            <UserAvatar
              userId={userId}
              displayName={identityLabel}
              fallbackUrl={avatarUrl?.trim() || null}
              size={56}
              className="account-summary-avatar"
              priority="eager"
            />
            <div>
              <strong>{displayName || username || "—"}</strong>
              <span>@{username || "—"}</span>
              <small>{maskEmail(email)}</small>
              <small>{softVerify}</small>
            </div>
          </div>
          <dl className="account-summary-meta">
            <div><dt>{t("account.memberSince")}</dt><dd>{memberSinceLabel}</dd></div>
            <div><dt>{t("account.plan")}</dt><dd>{planLabel}</dd></div>
            <div><dt>{t("account.status")}</dt><dd>{formatAccountStatus(accountStatusLabel, language)}</dd></div>
          </dl>
          <div className="settings-actions-row">
            <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={identityRefreshing} onClick={onRefreshIdentity}>
              {identityRefreshing ? t("account.refreshing") : t("account.refreshIdentity")}
            </button>
            <button type="button" className="settings-inline-action settings-inline-action--danger" onClick={onLogout}>
              {t("account.logout")}
            </button>
          </div>
        </div>
      </section>

      <section className="account-settings-section" id="settings-account-providers">
        <h3 className="account-settings-section-title">{t("account.providers")}</h3>
        <p className="settings-section-description">{t("account.providersHelp")}</p>
        <div className="security-card-grid" aria-label={t("account.providers")}>
          {socialProviders
            .filter((row) => row.provider === "google" || row.provider === "steam" || row.provider === "epic")
            .map((provider) => {
              const busy = socialProviderBusy === provider.provider;
              return (
                <article className="security-card" key={provider.provider}>
                  <span>{provider.label}</span>
                  <strong>{providerStatusLabel(provider, language)}</strong>
                  <small>
                    {provider.linked
                      ? t("provider.connectedHelp")
                      : provider.available
                        ? t("provider.notConnectedHelp")
                        : provider.reason || t("provider.unavailable")}
                  </small>
                  {provider.linked ? (
                    <button
                      type="button"
                      className="settings-inline-action settings-inline-action--ghost"
                      disabled={busy || !onDisconnectProvider}
                      onClick={() => onDisconnectProvider?.(provider.provider)}
                    >
                      {busy ? t("provider.disconnecting") : t("provider.disconnect")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="settings-inline-action"
                      disabled={busy || !provider.available || !onConnectProvider}
                      onClick={() => onConnectProvider?.(provider.provider)}
                    >
                      {busy ? t("provider.connecting") : t("provider.connect")}
                    </button>
                  )}
                </article>
              );
            })}
        </div>
      </section>

      {onOpenPublisherApply || onOpenPublisherDashboard ? (
        <section className="account-settings-section" id="settings-account-publisher" aria-label={t("account.publisherTitle")}>
          <h3 className="account-settings-section-title">{t("account.publisherTitle")}</h3>
          <div className="settings-status-card settings-feature-card">
            <small>{t("account.publisherHelp")}</small>
            <div className="settings-actions-row settings-actions-row--wrap">
              {onOpenPublisherApply ? (
                <button type="button" className="settings-inline-action" onClick={onOpenPublisherApply}>
                  {t("account.publisherApply")}
                </button>
              ) : null}
              {onOpenPublisherDashboard ? (
                <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={onOpenPublisherDashboard}>
                  {t("account.publisherDashboard")}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <PicomVerifiedDesktopCard language={language} onOpenAccountCenter={onOpenAccountCenter} />

      <section className="account-settings-section">
        <h3 className="account-settings-section-title">{t("account.centerTitle")}</h3>
        <div className="settings-status-card settings-feature-card">
          <small>{t("account.centerHelp")}</small>
          <div className="settings-actions-row settings-actions-row--wrap">
            <button type="button" className="settings-inline-action" onClick={() => onOpenAccountCenter(accountCenterUrls.profile)}>{t("account.editProfile")}</button>
            <button type="button" className="settings-inline-action" onClick={() => onOpenAccountCenter(accountCenterUrls.manageAccount)}>{t("account.openCenter")}</button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => onOpenAccountCenter(accountCenterUrls.businessApply)}>PICOM Business</button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => onOpenAccountCenter(accountCenterUrls.email)}>{t("account.emailPassword")}</button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => onOpenAccountCenter(accountCenterUrls.connections)}>{t("account.connections")}</button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => onOpenAccountCenter(accountCenterUrls.sessions)}>{t("account.sessions")}</button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => onOpenAccountCenter(accountCenterUrls.security)}>{t("account.security")}</button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => onOpenAccountCenter(accountCenterUrls.dataExport)}>{t("account.downloadData")}</button>
            <button type="button" className="settings-inline-action settings-inline-action--danger" onClick={() => onOpenAccountCenter(accountCenterUrls.deleteAccount)}>{t("account.delete")}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
