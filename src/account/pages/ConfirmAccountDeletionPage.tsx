import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FormStatus } from "../components/FormStatus";
import { t } from "../i18n/messages";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

type ConfirmationStatus = "checking" | "success" | "expired" | "used" | "invalid" | "error";

function classifyError(message: string | undefined): ConfirmationStatus {
  const value = (message ?? "").toLowerCase();
  if (value.includes("expired")) return "expired";
  if (value.includes("used") || value.includes("already")) return "used";
  if (value.includes("invalid")) return "invalid";
  return "error";
}

/** Redeems the email bearer token once, then removes it from the address bar. */
export function ConfirmAccountDeletionPage() {
  const [params] = useSearchParams();
  const started = useRef(false);
  const [status, setStatus] = useState<ConfirmationStatus>("checking");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = (params.get("token") ?? "").trim();
    window.history.replaceState({}, document.title, ROUTES.deleteAccountConfirm);
    if (!token) {
      setStatus("invalid");
      return;
    }

    const confirm = async () => {
      try {
        const supabase = getAccountSupabase();
        const { data, error } = await supabase.functions.invoke<{ status?: string }>("account-deletion", {
          body: { action: "confirm", token },
        });
        if (error || data?.status !== "pending_deletion") {
          setStatus(classifyError(error?.message));
          return;
        }
        setStatus("success");
      } catch {
        setStatus("error");
      }
    };
    void confirm();
  }, [params]);

  return (
    <section className="ac-card ac-stack">
      <h1>{t("delete.confirmEmailTitle")}</h1>
      {status === "checking" ? <FormStatus tone="loading" message={t("delete.confirmingEmail")} /> : null}
      {status === "success" ? <FormStatus tone="success" message={t("delete.emailConfirmed")} /> : null}
      {status === "expired" ? <FormStatus tone="error" message={t("delete.confirmationExpired")} /> : null}
      {status === "used" ? <FormStatus tone="error" message={t("delete.confirmationUsed")} /> : null}
      {status === "invalid" ? <FormStatus tone="error" message={t("delete.confirmationInvalid")} /> : null}
      {status === "error" ? <FormStatus tone="error" message={t("common.error")} /> : null}
      {status !== "checking" ? (
        <div className="ac-actions">
          <Link className="ac-btn ac-btn--primary" to={ROUTES.login}>{t("home.login")}</Link>
          <Link className="ac-btn ac-btn--secondary" to={ROUTES.deleteAccount}>{t("delete.title")}</Link>
        </div>
      ) : null}
    </section>
  );
}
