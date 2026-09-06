import { useEffect, useState } from "react";
import { accountDeletionService, type AccountDeletionStatus } from "../../services/accountDeletionService";
import { featureFlagService } from "../../services/featureFlagService";
import { FormStatus } from "../components/FormStatus";
import { t } from "../i18n/messages";

function formatScheduledDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export function DeletePage() {
  const [status, setStatus] = useState<AccountDeletionStatus>(() => accountDeletionService.getStatus());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creationEnabled, setCreationEnabled] = useState(() => featureFlagService.isEnabled("ACCOUNT_30_DAY_DELETION_ENABLED"));

  useEffect(() => {
    let cancelled = false;
    void accountDeletionService.refreshStatus().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => featureFlagService.subscribe((snapshot) => {
    setCreationEnabled(snapshot.flags.ACCOUNT_30_DAY_DELETION_ENABLED);
  }), []);

  async function requestDeletion() {
    setLoading(true);
    setError(null);
    setMessage(null);
    const result = await accountDeletionService.requestDeletion();
    setLoading(false);
    if (!result.ok) {
      setError(result.message || t("delete.emailSendFailed"));
      return;
    }
    setStatus(result.data);
    setMessage(result.data.status === "email_pending" ? t("delete.emailSent") : t("delete.emailConfirmed"));
  }

  async function cancelDeletion() {
    setLoading(true);
    setError(null);
    const result = await accountDeletionService.cancelDeletion();
    setLoading(false);
    if (!result.ok) {
      setError(result.message || t("common.error"));
      return;
    }
    setStatus(result.data);
    setMessage(t("delete.canceled"));
  }

  const pendingDeletion = status.status === "pending_deletion";
  const emailPending = status.status === "email_pending";

  return (
    <section className="ac-page">
      <h1>{t("delete.title")}</h1>
      <p className="ac-muted">{t("delete.body")}</p>
      <div className="ac-danger-zone ac-stack">
        <h2>{t("delete.danger")}</h2>
        <FormStatus tone="success" message={message} />
        <FormStatus tone="error" message={error} />

        {pendingDeletion ? (
          <>
            <p className="ac-muted">{t("delete.scheduled").replace("{date}", formatScheduledDate(status.scheduledDeletionAt))}</p>
            <button type="button" className="ac-btn ac-btn--ghost" disabled={loading} onClick={() => void cancelDeletion()}>
              {loading ? t("form.working") : t("delete.cancelRequest")}
            </button>
          </>
        ) : emailPending ? (
          <>
            <p className="ac-muted">{t("delete.emailSent")}</p>
            <button type="button" className="ac-btn ac-btn--ghost" disabled={loading} onClick={() => void cancelDeletion()}>
              {loading ? t("form.working") : t("delete.cancelRequest")}
            </button>
          </>
        ) : creationEnabled ? (
          <button type="button" className="ac-btn ac-btn--danger" disabled={loading} onClick={() => void requestDeletion()}>
            {loading ? t("form.working") : t("delete.submit")}
          </button>
        ) : (
          <p className="ac-muted">{t("delete.unavailable")}</p>
        )}
      </div>
    </section>
  );
}
