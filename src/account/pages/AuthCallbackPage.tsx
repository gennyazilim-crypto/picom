import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FormStatus } from "../components/FormStatus";
import { t } from "../i18n/messages";
import { safeReturnTo } from "../lib/returnTo";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [providerHandoffDone, setProviderHandoffDone] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getAccountSupabase();
    const code = params.get("code");
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    const next = safeReturnTo(params.get("next") ?? params.get("returnTo"), ROUTES.accountOverview);

    const run = async () => {
      if (params.get("error") || params.get("error_description")) {
        navigate(`${ROUTES.authError}?reason=provider`, { replace: true });
        return;
      }

      // Steam/Epic desktop handoff may historically land here with status=ok|linked
      // but no Supabase OAuth code. That is not a failed email/OAuth link — the
      // desktop app already polls for the session.
      const provider = (params.get("provider") || "").toLowerCase();
      const status = (params.get("status") || "").toLowerCase();
      if (
        (provider === "steam" || provider === "epic")
        && (status === "ok" || status === "linked" || status === "connected")
        && !params.get("code")
        && !params.get("token_hash")
      ) {
        setProviderHandoffDone(provider === "steam" ? "Steam" : "Epic");
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(t("callback.error"));
          navigate(ROUTES.authError, { replace: true });
          return;
        }
      } else if (tokenHash && type) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "recovery" | "signup" | "email" | "email_change" | "invite" | "magiclink",
        });
        if (otpError) {
          setError(t("callback.error"));
          navigate(ROUTES.authError, { replace: true });
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate(ROUTES.authError, { replace: true });
        return;
      }

      if (type === "recovery") {
        navigate(ROUTES.resetPassword, { replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_completed_at,onboarding_completed")
        .eq("id", data.session.user.id)
        .maybeSingle();

      const completed = Boolean(
        (profile as { profile_completed_at?: string | null; onboarding_completed?: boolean } | null)?.profile_completed_at
        || (profile as { onboarding_completed?: boolean } | null)?.onboarding_completed,
      );

      navigate(completed ? next : ROUTES.profileSetup, { replace: true });
    };

    void run();
  }, [navigate, params]);

  if (providerHandoffDone) {
    return (
      <section className="ac-card">
        <h1>{t("callback.providerDoneTitle")}</h1>
        <p className="ac-muted">{t("callback.providerDoneBody").replace("{provider}", providerHandoffDone)}</p>
        <p>
          <Link to={ROUTES.login}>{t("login.title")}</Link>
          {" · "}
          <a href="picom://auth/open">Picom</a>
        </p>
      </section>
    );
  }

  return (
    <section className="ac-card">
      <h1>{t("callback.working")}</h1>
      <FormStatus tone="loading" message={t("callback.working")} />
      <FormStatus tone="error" message={error} />
    </section>
  );
}
