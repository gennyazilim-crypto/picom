import { FormEvent, useEffect, useState } from "react";
import { FormStatus } from "../components/FormStatus";
import { t } from "../i18n/messages";
import { getAccountSupabase } from "../lib/supabase";

type VerificationRow = {
  id: string;
  status: string;
  type: string;
  category?: string | null;
  decision_reason?: string | null;
  requested_at: string;
};

export function ProfileVerificationPage() {
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [category, setCategory] = useState("individual");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const supabase = getAccountSupabase();
    const { data, error: loadError } = await supabase.rpc("get_own_profile_verification_requests");
    if (loadError) setError(t("common.error"));
    else setRows((data as VerificationRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    const supabase = getAccountSupabase();
    const { error: requestError } = await supabase.rpc("request_profile_verification", {
      request_type: "verified_user",
      request_category: category,
      request_reason: reason.trim(),
      request_links: [],
      request_supporting_text: null,
    });
    setSubmitting(false);
    if (requestError) {
      setError(requestError.message || t("common.error"));
      return;
    }
    setMessage(t("common.success"));
    setReason("");
    await reload();
  };

  return (
    <section className="ac-page">
      <h1>{t("profileVerification.title")}</h1>
      <p className="ac-muted">{t("profileVerification.body")}</p>
      {loading ? <FormStatus tone="loading" message={t("common.loading")} /> : null}
      <ul className="ac-list">
        {rows.length === 0 ? <li className="ac-muted">{t("profileVerification.none")}</li> : null}
        {rows.map((row) => (
          <li key={row.id}>
            <strong>{row.status}</strong> · {row.type} · {new Date(row.requested_at).toLocaleString()}
            {row.decision_reason ? <div className="ac-muted">{row.decision_reason}</div> : null}
          </li>
        ))}
      </ul>
      <form className="ac-form" onSubmit={onSubmit}>
        <label className="ac-field">
          <span>Type</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="individual">Individual</option>
            <option value="creator">Creator</option>
            <option value="organization">Organization</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="ac-field">
          <span>Application text</span>
          <textarea required minLength={20} maxLength={1000} rows={5} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <FormStatus tone="success" message={message} />
        <FormStatus tone="error" message={error} />
        <button className="ac-btn ac-btn--primary" type="submit" disabled={submitting}>
          {submitting ? t("form.working") : t("common.submit")}
        </button>
      </form>
    </section>
  );
}
