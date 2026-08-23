import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FormStatus } from "../components/FormStatus";
import { SUPPORT_HOME_URL } from "../config";
import { t } from "../i18n/messages";
import { consumeSoftEmailVerificationToken } from "../lib/softEmailVerification";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

type UiStatus = "verifying" | "success" | "expired" | "invalid" | "already_used" | "email_changed" | "server_error";

function classifyVerificationError(message: string): UiStatus {
  const normalized = message.toLowerCase();
  if (normalized.includes("expired")) return "expired";
  if (normalized.includes("used") || normalized.includes("already")) return "already_used";
  return "invalid";
}

function outcomePath(status: UiStatus): string {
  if (status === "success") return ROUTES.verifyEmailSuccess;
  if (status === "expired") return ROUTES.verifyEmailExpired;
  return ROUTES.verifyEmailFailed;
}

function isUiStatus(value: unknown): value is UiStatus {
  return value === "success"
    || value === "expired"
    || value === "invalid"
    || value === "already_used"
    || value === "email_changed"
    || value === "server_error";
}

export function VerifyEmailPage({ forcedStatus }: { forcedStatus?: Exclude<UiStatus, "verifying"> }) {
  const { opaqueCode } = useParams<{ opaqueCode?: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const started = useRef(false);
  const stateStatus = isUiStatus((location.state as { verifyStatus?: unknown } | null)?.verifyStatus)
    ? (location.state as { verifyStatus: UiStatus }).verifyStatus
    : null;
  const [status, setStatus] = useState<UiStatus>(forcedStatus ?? stateStatus ?? "verifying");

  useEffect(() => {
    if (forcedStatus) {
      setStatus(stateStatus && forcedStatus === "invalid" ? stateStatus : forcedStatus);
      return;
    }
    if (started.current) return;
    started.current = true;
    const customToken = (opaqueCode ?? params.get("token") ?? "").trim();
    const tokenHash = (params.get("token_hash") ?? "").trim();
    const type = (params.get("type") ?? "").trim();

    const finish = (next: UiStatus) => {
      setStatus(next);
      navigate(outcomePath(next), { replace: true, state: { verifyStatus: next } });
    };

    const run = async () => {
      try {
        if (customToken) {
          const result = await consumeSoftEmailVerificationToken(customToken);
          finish(result.ok ? "success" : result.status);
          return;
        }
        if (!tokenHash || type !== "email") {
          finish("invalid");
          return;
        }
        const supabase = getAccountSupabase();
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
        if (error) {
          finish(classifyVerificationError(error.message));
          return;
        }
        await supabase.auth.getUser();
        await supabase.auth.signOut({ scope: "local" });
        finish("success");
      } catch {
        finish("server_error");
      }
    };
    void run();
  }, [forcedStatus, navigate, opaqueCode, params, stateStatus]);

  return (
    <section className="ac-card ac-stack">
      <h1>{t("softVerify.title")}</h1>
      {status === "verifying" ? <FormStatus tone="loading" message={t("softVerify.verifying")} /> : null}
      {status === "success" ? (
        <>
          <FormStatus tone="success" message={t("softVerify.successBody")} />
          <div className="ac-actions">
            <Link className="ac-btn ac-btn--primary" to={ROUTES.login}>{t("home.login")}</Link>
            <a className="ac-btn ac-btn--secondary" href="picom://auth/verify-email?status=success">{t("softVerify.openPicom")}</a>
          </div>
        </>
      ) : null}
      {status === "expired" ? <FormStatus tone="error" message={t("softVerify.expired")} /> : null}
      {status === "already_used" ? <FormStatus tone="error" message={t("softVerify.alreadyUsed")} /> : null}
      {status === "email_changed" ? <FormStatus tone="error" message={t("softVerify.emailChanged")} /> : null}
      {status === "invalid" ? <FormStatus tone="error" message={t("softVerify.invalid")} /> : null}
      {status === "server_error" ? <FormStatus tone="error" message={t("softVerify.serverError")} /> : null}
      {status !== "verifying" && status !== "success" ? (
        <div className="ac-actions">
          <Link className="ac-btn ac-btn--primary" to={ROUTES.login}>{t("softVerify.signInToResend")}</Link>
          <a className="ac-btn ac-btn--secondary" href={SUPPORT_HOME_URL}>{t("nav.support")}</a>
        </div>
      ) : null}
    </section>
  );
}
