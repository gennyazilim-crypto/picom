import { FormEvent, useState } from "react";
import { FormStatus } from "../components/FormStatus";
import { ACCOUNT_AUTH } from "../config";
import { t } from "../i18n/messages";
import { useAuth } from "../lib/session";
import { getAccountSupabase } from "../lib/supabase";

export function EmailChangePage() {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.email) return;
    setLoading(true);
    setError(null);
    setMessage(null);
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
    const { error: updateError } = await supabase.auth.updateUser(
      { email: nextEmail.trim().toLowerCase() },
      { emailRedirectTo: ACCOUNT_AUTH.changeEmailUrl },
    );
    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    // Soft verification resets when email changes (PICOM status, not Auth confirm).
    await supabase.rpc("mark_email_verification_email_changed");
    void import("../lib/softEmailVerification").then(({ sendSoftEmailVerification }) =>
      sendSoftEmailVerification("send"),
    );

    setPassword("");
    setNextEmail("");
    setLoading(false);
    setMessage(t("emailChange.sent"));
  };

  return (
    <section className="ac-page">
      <h1>{t("emailChange.title")}</h1>
      <p className="ac-muted">{user?.email}</p>
      <form className="ac-form" onSubmit={onSubmit}>
        <label className="ac-field">
          <span>{t("password.current")}</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="ac-field">
          <span>{t("emailChange.new")}</span>
          <input type="email" autoComplete="email" required value={nextEmail} onChange={(e) => setNextEmail(e.target.value)} />
        </label>
        <FormStatus tone="success" message={message} />
        <FormStatus tone="error" message={error} />
        <button className="ac-btn ac-btn--primary" type="submit" disabled={loading}>
          {loading ? t("form.working") : t("emailChange.submit")}
        </button>
      </form>
    </section>
  );
}
