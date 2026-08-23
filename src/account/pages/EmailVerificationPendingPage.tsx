import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FormStatus } from "../components/FormStatus";
import { AccountCard, StatusBadge } from "../components/ui";
import { IconMail } from "../components/AccountIcons";
import { APP_HOME_URL } from "../config";
import { t } from "../i18n/messages";
import { fetchSoftEmailVerificationStatus, sendSoftEmailVerification } from "../lib/softEmailVerification";
import { ROUTES } from "../routes";

/**
 * Soft reminder page — not a lock screen.
 * Unverified users may leave and use PICOM immediately.
 */
export function EmailVerificationPendingPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [masked, setMasked] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchSoftEmailVerificationStatus().then((status) => {
      if (cancelled) return;
      setMasked(status.emailMasked);
      setVerified(status.isEmailVerified);
      setVerifiedAt(status.emailVerifiedAt);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resend = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    const result = await sendSoftEmailVerification("resend");
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.alreadyVerified) {
      setVerified(true);
      setMessage(t("softVerify.alreadyVerified"));
      return;
    }
    setMessage(t("softVerify.sent"));
  };

  return (
    <section className="ac-page ac-page--narrow">
      <AccountCard title={t("softVerify.cardTitle")} icon={<IconMail />}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
          <StatusBadge tone={verified ? "success" : "warning"}>
            {verified ? t("softVerify.verifiedBadge") : t("softVerify.unverifiedBadge")}
          </StatusBadge>
          {masked ? <span className="ac-muted">{masked}</span> : null}
        </div>
        <p className="ac-muted" style={{ marginTop: 0 }}>
          {verified ? t("softVerify.successBody") : t("softVerify.unverifiedBody")}
        </p>
        {verified && verifiedAt ? (
          <p className="ac-muted">{t("softVerify.verifiedAt")}: {new Date(verifiedAt).toLocaleString()}</p>
        ) : null}
        {!verified ? (
          <form onSubmit={resend} className="ac-actions" style={{ marginTop: "1rem" }}>
            <button className="ac-btn ac-btn--primary" type="submit" disabled={loading}>
              {loading ? t("form.working") : t("softVerify.send")}
            </button>
            <Link className="ac-btn ac-btn--secondary" to={ROUTES.emailChange}>{t("softVerify.changeEmail")}</Link>
            <Link className="ac-btn ac-btn--ghost" to={ROUTES.accountOverview}>{t("softVerify.later")}</Link>
          </form>
        ) : (
          <div className="ac-actions" style={{ marginTop: "1rem" }}>
            <a className="ac-btn ac-btn--primary" href={APP_HOME_URL}>{t("softVerify.openPicom")}</a>
            <Link className="ac-btn ac-btn--secondary" to={ROUTES.accountOverview}>{t("softVerify.openAccount")}</Link>
            <Link className="ac-btn ac-btn--ghost" to={ROUTES.emailChange}>{t("softVerify.changeEmail")}</Link>
          </div>
        )}
        <FormStatus tone={error ? "error" : "success"} message={error ?? message} />
      </AccountCard>
    </section>
  );
}
