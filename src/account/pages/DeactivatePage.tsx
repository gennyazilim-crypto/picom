import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormStatus } from "../components/FormStatus";
import { t } from "../i18n/messages";
import { useAuth } from "../lib/session";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

export function DeactivatePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.email || !confirmed) {
      setError(t("common.required"));
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = getAccountSupabase();
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (reauthError) {
      setLoading(false);
      setError(t("password.reauthFailed"));
      return;
    }

    const deactivatedAt = new Date().toISOString();
    const { error: rpcError } = await supabase.rpc("deactivate_own_account");
    if (rpcError) {
      const { error: metaError } = await supabase.auth.updateUser({
        data: { account_status: "deactivated", deactivated_at: deactivatedAt },
      });
      if (metaError) {
        setLoading(false);
        setError(metaError.message);
        return;
      }
    }

    await supabase.auth.signOut({ scope: "global" });
    await signOut();
    setLoading(false);
    setMessage(t("deactivate.done"));
    navigate(ROUTES.login, { replace: true });
  };

  return (
    <section className="ac-page">
      <h1>{t("deactivate.title")}</h1>
      <p className="ac-muted">{t("deactivate.body")}</p>
      <form className="ac-danger-zone ac-form" onSubmit={(e) => void onSubmit(e)}>
        <label className="ac-field">
          <span>{t("password.current")}</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="ac-check">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>{t("deactivate.confirm")}</span>
        </label>
        <FormStatus tone="success" message={message} />
        <FormStatus tone="error" message={error} />
        <button className="ac-btn ac-btn--danger" type="submit" disabled={loading}>
          {loading ? t("form.working") : t("deactivate.submit")}
        </button>
      </form>
    </section>
  );
}
