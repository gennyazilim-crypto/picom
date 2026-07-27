import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FormStatus } from "../components/FormStatus";
import { t } from "../i18n/messages";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

export function ProfileSetupPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = getAccountSupabase();
    const { error: rpcError } = await supabase.rpc("complete_account_profile", {
      payload: {
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        country_code: country.trim().toUpperCase().slice(0, 2) || null,
        timezone,
        preferred_language: language,
      },
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message || t("common.error"));
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      const { continueToProduct, captureContinueContextFromLocation } = await import("../lib/continueToProduct");
      captureContinueContextFromLocation();
      const continued = await continueToProduct(sessionData.session, { preferProduct: true });
      if (continued.redirected) return;
    }
    navigate(ROUTES.accountOverview, { replace: true });
  };

  return (
    <section className="ac-page">
      <h1>{t("profileSetup.title")}</h1>
      <p className="ac-muted">{t("profileSetup.subtitle")}</p>
      <form className="ac-form" onSubmit={onSubmit}>
        <label className="ac-field">
          <span>{t("common.username")}</span>
          <input required pattern="[A-Za-z0-9_]{3,24}" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="ac-field">
          <span>{t("common.displayName")}</span>
          <input required maxLength={64} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="ac-field">
          <span>{t("profile.bio")}</span>
          <textarea maxLength={280} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        <label className="ac-field">
          <span>{t("common.country")}</span>
          <input maxLength={2} value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>
        <label className="ac-field">
          <span>Timezone</span>
          <input required value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </label>
        <label className="ac-field">
          <span>{t("common.language")}</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="tr">Türkçe</option>
          </select>
        </label>
        <FormStatus tone="error" message={error} />
        <button className="ac-btn ac-btn--primary" type="submit" disabled={loading}>
          {loading ? t("form.working") : t("profileSetup.submit")}
        </button>
      </form>
    </section>
  );
}
