import { FormEvent, useState } from "react";
import { FormStatus } from "../components/FormStatus";
import { t } from "../i18n/messages";
import { useAuth } from "../lib/session";
import { getAccountSupabase } from "../lib/supabase";

export function PasswordChangePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.email) return;
    if (nextPassword !== confirm) {
      setError(t("register.passwordMismatch"));
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const supabase = getAccountSupabase();
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (reauthError) {
      setLoading(false);
      setError(t("password.reauthFailed"));
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }
    if (revokeOthers) {
      await supabase.auth.signOut({ scope: "others" });
      await supabase.rpc("revoke_other_device_sessions");
    }
    setCurrentPassword("");
    setNextPassword("");
    setConfirm("");
    setLoading(false);
    setMessage(t("password.updated"));
  };

  return (
    <section className="ac-page">
      <h1>{t("password.title")}</h1>
      <form className="ac-form" onSubmit={onSubmit}>
        <label className="ac-field">
          <span>{t("password.current")}</span>
          <input type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </label>
        <label className="ac-field">
          <span>{t("password.new")}</span>
          <input type="password" autoComplete="new-password" minLength={12} required value={nextPassword} onChange={(e) => setNextPassword(e.target.value)} />
        </label>
        <label className="ac-field">
          <span>{t("password.confirm")}</span>
          <input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <label className="ac-check">
          <input type="checkbox" checked={revokeOthers} onChange={(e) => setRevokeOthers(e.target.checked)} />
          <span>{t("sessions.revokeOthers")}</span>
        </label>
        <FormStatus tone="success" message={message} />
        <FormStatus tone="error" message={error} />
        <button className="ac-btn ac-btn--primary" type="submit" disabled={loading}>
          {loading ? t("form.working") : t("password.submit")}
        </button>
      </form>
    </section>
  );
}
