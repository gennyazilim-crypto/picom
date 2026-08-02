import { FormEvent, useEffect, useState } from "react";
import { FormStatus } from "../components/FormStatus";
import { t } from "../i18n/messages";
import { getAccountSupabase } from "../lib/supabase";

type Factor = { id: string; friendly_name?: string; status: string; factor_type: string };

export function MfaPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const supabase = getAccountSupabase();
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) setError(listError.message);
    else setFactors((data?.all ?? []) as Factor[]);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const startEnroll = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const supabase = getAccountSupabase();
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Picom Authenticator",
    });
    setBusy(false);
    if (enrollError || !data) {
      setError(enrollError?.message ?? t("common.error"));
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
  };

  const verifyEnroll = async (event: FormEvent) => {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = getAccountSupabase();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      setBusy(false);
      setError(challenge.error?.message ?? t("common.error"));
      return;
    }
    const verified = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    setBusy(false);
    if (verified.error) {
      setError(verified.error.message);
      return;
    }
    setQr(null);
    setSecret(null);
    setFactorId(null);
    setCode("");
    setMessage(t("mfa.enrolled"));
    await reload();
  };

  const unenroll = async (id: string) => {
    setBusy(true);
    setError(null);
    const supabase = getAccountSupabase();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (unenrollError) {
      setError(unenrollError.message);
      return;
    }
    setMessage(t("mfa.factorRemoved"));
    await reload();
  };

  if (loading) return <FormStatus tone="loading" message={t("common.loading")} />;

  return (
    <section className="ac-page">
      <h1>{t("mfa.title")}</h1>
      <p className="ac-muted">{t("mfa.subtitle")}</p>
      <p>{factors.some((f) => f.status === "verified") ? t("mfa.enabled") : t("mfa.disabled")}</p>
      <ul className="ac-list">
        {factors.map((factor) => (
          <li key={factor.id}>
            {factor.friendly_name || factor.factor_type} · {factor.status}
            {factor.status === "verified" ? (
              <button className="ac-btn ac-btn--danger" type="button" disabled={busy} onClick={() => void unenroll(factor.id)}>
                {t("mfa.unenroll")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!qr ? (
        <button className="ac-btn ac-btn--primary" type="button" disabled={busy} onClick={() => void startEnroll()}>
          {t("mfa.enroll")}
        </button>
      ) : (
        <form className="ac-form" onSubmit={verifyEnroll}>
          {qr.startsWith("data:") ? <img src={qr} alt="MFA QR" width={200} height={200} /> : <pre>{qr}</pre>}
          {secret ? <p className="ac-muted">Secret: {secret}</p> : null}
          <label className="ac-field">
            <span>{t("mfa.code")}</span>
            <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button className="ac-btn ac-btn--primary" type="submit" disabled={busy}>
            {t("mfa.verify")}
          </button>
        </form>
      )}
      <FormStatus tone="success" message={message} />
      <FormStatus tone="error" message={error} />
    </section>
  );
}
