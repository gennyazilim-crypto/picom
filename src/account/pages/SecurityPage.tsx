import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IconDevices, IconKey, IconLock, IconMail, IconShield } from "../components/AccountIcons";
import { FormStatus } from "../components/FormStatus";
import { AccountCard, StatusBadge } from "../components/ui";
import { SUPPORT_HOME_URL } from "../config";
import { t } from "../i18n/messages";
import {
  fetchSoftEmailVerificationStatus,
  type SoftEmailVerificationState,
} from "../lib/softEmailVerification";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

export function SecurityPage() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [emailState, setEmailState] = useState<SoftEmailVerificationState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getAccountSupabase();
    void Promise.all([
      supabase.auth.mfa.listFactors(),
      fetchSoftEmailVerificationStatus(),
    ]).then(([mfa, email]) => {
      setMfaEnabled((mfa.data?.totp ?? []).some((factor) => factor.status === "verified"));
      setEmailState(email);
      setLoading(false);
    });
  }, []);

  const emailVerified = Boolean(emailState?.isEmailVerified);
  const done = 1 + (mfaEnabled ? 1 : 0) + (emailVerified ? 1 : 0) + 1;
  const total = 4;
  const completed = Math.min(done, total);
  const needed = total - completed;
  const percent = Math.round((completed / total) * 100);

  return (
    <section className="ac-page ac-page--narrow">
      <AccountCard>
        <div className="ac-page-header__row">
          <div>
            <h2 className="ac-surface-card__title">{t("security.readiness")}</h2>
            <p className="ac-muted">
              {t("security.checksSummary").replace("{done}", String(completed)).replace("{total}", String(total))}
              {needed > 0 ? ` — ${t("security.actionsNeeded").replace("{count}", String(needed))}` : ""}
            </p>
          </div>
          <StatusBadge tone={percent >= 75 ? "success" : "warning"}>{percent}% {t("security.complete")}</StatusBadge>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: "var(--surface-muted)",
            margin: "0.85rem 0 0.35rem",
            overflow: "hidden",
          }}
          aria-hidden="true"
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              background: percent >= 75 ? "var(--success)" : "var(--warning)",
            }}
          />
        </div>
        {loading ? <FormStatus tone="loading" message={t("common.loading")} /> : null}
        <Link className="ac-security-check" to={ROUTES.passwordChange}>
          <IconKey />
          <div className="ac-security-check__copy">
            <strong>{t("security.password")}</strong>
            <span>{t("security.passwordHint")}</span>
          </div>
          <StatusBadge tone="success">{t("overview.set")}</StatusBadge>
        </Link>
        <Link className="ac-security-check" to={ROUTES.connections}>
          <IconDevices />
          <div className="ac-security-check__copy">
            <strong>{t("nav.connections")}</strong>
            <span>{t("connections.subtitle")}</span>
          </div>
          <StatusBadge tone="info">{t("nav.connections")}</StatusBadge>
        </Link>
        <Link className="ac-security-check" to={ROUTES.mfa}>
          <IconLock />
          <div className="ac-security-check__copy">
            <strong>{t("security.mfa")}</strong>
            <span>{t("security.mfaHint")}</span>
          </div>
          <StatusBadge tone={mfaEnabled ? "success" : "warning"}>
            {mfaEnabled ? t("overview.set") : t("overview.pending")}
          </StatusBadge>
        </Link>
        <Link className="ac-security-check" to={ROUTES.emailVerification}>
          <IconMail />
          <div className="ac-security-check__copy">
            <strong>{t("security.email")}</strong>
            <span>{t("security.emailHint")}</span>
          </div>
          <StatusBadge tone={emailVerified ? "success" : "warning"}>
            {emailVerified ? t("overview.set") : t("overview.pending")}
          </StatusBadge>
        </Link>
        <Link className="ac-security-check" to={ROUTES.sessions}>
          <IconDevices />
          <div className="ac-security-check__copy">
            <strong>{t("security.sessions")}</strong>
            <span>{t("security.sessionsHint")}</span>
          </div>
          <StatusBadge tone="info">{t("overview.viewAll")}</StatusBadge>
        </Link>
      </AccountCard>

      <div className="ac-quick-grid">
        <Link className="ac-quick-tile" to={ROUTES.passwordChange}><IconKey />{t("nav.password")}</Link>
        <Link className="ac-quick-tile" to={ROUTES.mfa}><IconLock />{t("nav.mfa")}</Link>
        <Link className="ac-quick-tile" to={ROUTES.sessions}><IconDevices />{t("nav.sessions")}</Link>
        <Link className="ac-quick-tile" to={ROUTES.emailChange}><IconMail />{t("nav.emailAddress")}</Link>
      </div>

      <AccountCard title={t("security.suspicious")} icon={<IconShield />}>
        <p className="ac-muted">{t("security.suspiciousBody")}</p>
        <a className="ac-btn ac-btn--secondary" href={SUPPORT_HOME_URL} style={{ marginTop: "0.85rem" }}>
          {t("security.report")}
        </a>
      </AccountCard>
    </section>
  );
}
