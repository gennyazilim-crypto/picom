import type { SocialProviderAccountState } from "../../services/auth/socialAuthService";
import { accountCenterUrls } from "../../config/accountCenterUrls";
import { translateSettings } from "../../services/settings/settingsI18n";

function maskEmail(email: string | null | undefined): string {
  const value = String(email || "").trim();
  if (!value.includes("@")) return "—";
  const [local, domain] = value.split("@");
  if (!domain) return "—";
  const head = (local || "*").slice(0, 1);
  return `${head}***@${domain}`;
}

function providerStatusLabel(provider: SocialProviderAccountState, language: "en" | "tr"): string {
  if (provider.provider === "google") return translateSettings("provider.googlePaused", language);
  if (provider.provider === "epic" && !provider.linked) return translateSettings("provider.epicPending", language);
  if (provider.linked) return translateSettings("provider.connected", language);
  if (provider.available) return translateSettings("provider.notConnected", language);
  return provider.reason || translateSettings("provider.unavailable", language);
}

export type AccountSummarySectionProps = Readonly<{
  language: "en" | "tr";
  displayName: string;
  username: string;
  email: string | null;
  emailVerifiedAt: string | null;
  avatarUrl?: string | null;
  memberSinceLabel: string;
  planLabel: string;
  accountStatusLabel: string;
  socialProviders: readonly SocialProviderAccountState[];
  onOpenAccountCenter: (url: string) => void;
  onLogout: () => void;
  onRefreshIdentity: () => void;
  identityRefreshing: boolean;
}>;

function formatAccountStatus(status: string, language: "en" | "tr"): string {
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
  displayName,
  username,
  email,
  emailVerifiedAt,
  avatarUrl,
  memberSinceLabel,
  planLabel,
  accountStatusLabel,
  socialProviders,
  onOpenAccountCenter,
  onLogout,
  onRefreshIdentity,
  identityRefreshing,
}: AccountSummarySectionProps) {
  const t = (key: Parameters<typeof translateSettings>[0], params?: Record<string, string | number>) =>
    translateSettings(key, language, params);
  const softVerify = emailVerifiedAt
    ? t("account.emailVerified", { when: emailVerifiedAt })
    : t("account.emailPending");

  return (
    <div className="account-settings-stack" id="settings-account-summary">
      <p className="settings-section-description">{t("account.summaryDescription")}</p>

      <section className="account-settings-section" aria-label={t("account.centerTitle")}>
        <div className="settings-status-card settings-feature-card account-summary-card">
          <div className="account-summary-identity">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="account-summary-avatar" width={56} height={56} />
            ) : (
              <span className="account-summary-avatar account-summary-avatar--fallback" aria-hidden="true">
                {(displayName || username || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
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
        <div className="security-card-grid" aria-label={t("account.providers")}>
          {socialProviders
            .filter((row) => row.provider === "google" || row.provider === "steam" || row.provider === "epic")
            .map((provider) => (
              <article className="security-card" key={provider.provider}>
                <span>{provider.label}</span>
                <strong>{providerStatusLabel(provider, language)}</strong>
                <small>
                  {provider.provider === "steam" && provider.linked
                    ? t("provider.steamBackend")
                    : provider.reason || t("provider.manageCenter")}
                </small>
              </article>
            ))}
        </div>
      </section>

      <section className="account-settings-section">
        <h3 className="account-settings-section-title">{t("account.centerTitle")}</h3>
        <div className="settings-status-card settings-feature-card">
          <small>{t("account.centerHelp")}</small>
          <div className="settings-actions-row settings-actions-row--wrap">
            <button type="button" className="settings-inline-action" onClick={() => onOpenAccountCenter(accountCenterUrls.profile)}>{t("account.editProfile")}</button>
            <button type="button" className="settings-inline-action" onClick={() => onOpenAccountCenter(accountCenterUrls.manageAccount)}>{t("account.openCenter")}</button>
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
