import { FormEvent, useEffect, useState } from "react";
import { FormStatus } from "../components/FormStatus";
import { AccountCard } from "../components/ui";
import { ThemeSelector } from "../components/ThemeSelector";
import { IconMonitor, IconSliders } from "../components/AccountIcons";
import { getLocale, setLocale, t, type AccountLocale } from "../i18n/messages";
import { useAuth } from "../lib/session";
import { useAccountTheme } from "../lib/theme";
import { getAccountSupabase } from "../lib/supabase";

export function PreferencesPage() {
  const { user } = useAuth();
  const { mode } = useAccountTheme();
  const [language, setLanguage] = useState<AccountLocale>(getLocale());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLanguage(getLocale());
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    const supabase = getAccountSupabase();
    const { error: saveError } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      theme_mode: mode,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setLocale(language);
    setMessage(t("preferences.saved"));
  };

  return (
    <section className="ac-page ac-page--narrow">
      <form className="ac-stack" onSubmit={onSubmit}>
        <AccountCard title={t("preferences.appearance")} icon={<IconMonitor />}>
          <ThemeSelector />
        </AccountCard>

        <AccountCard title={t("preferences.language")} icon={<IconSliders />}>
          <label className="ac-field">
            <span>{t("preferences.language")}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value as AccountLocale)}>
              <option value="en">English</option>
              <option value="tr">Türkçe</option>
            </select>
          </label>
        </AccountCard>

        <FormStatus tone="success" message={message} />
        <FormStatus tone="error" message={error} />
        <button className="ac-btn ac-btn--primary" type="submit" disabled={saving}>
          {saving ? t("form.working") : t("preferences.save")}
        </button>
      </form>
    </section>
  );
}
