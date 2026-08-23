import { FormEvent, useEffect, useState } from "react";
import { FormStatus } from "../components/FormStatus";
import { t } from "../i18n/messages";
import { useAuth } from "../lib/session";
import { getAccountSupabase } from "../lib/supabase";

type Prefs = {
  security_email: boolean;
  product_updates: boolean;
  marketing_email: boolean;
  dm_notifications: boolean;
  community_notifications: boolean;
};

const DEFAULTS: Prefs = {
  security_email: true,
  product_updates: true,
  marketing_email: false,
  dm_notifications: true,
  community_notifications: true,
};

export function NotificationsPage() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = getAccountSupabase();
    void supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPrefs({ ...DEFAULTS, ...(data as Prefs), security_email: true });
        setLoading(false);
      });
  }, [user]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    const supabase = getAccountSupabase();
    const { error: saveError } = await supabase.from("notification_preferences").upsert({
      user_id: user.id,
      ...prefs,
      security_email: true,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (saveError) {
      // Fallback to user_settings.notification_settings jsonb
      const fallback = await supabase.from("user_settings").upsert({
        user_id: user.id,
        notification_settings: { ...prefs, security_email: true },
        updated_at: new Date().toISOString(),
      });
      if (fallback.error) {
        setError(fallback.error.message);
        return;
      }
    }
    setMessage(t("notifications.saved"));
  };

  if (loading) return <FormStatus tone="loading" message={t("common.loading")} />;

  return (
    <section className="ac-page">
      <h1>{t("notifications.title")}</h1>
      <form className="ac-form" onSubmit={onSubmit}>
        <label className="ac-check">
          <input type="checkbox" checked disabled />
          <span>{t("notifications.emailSecurity")} (required)</span>
        </label>
        <label className="ac-check">
          <input type="checkbox" checked={prefs.product_updates} onChange={(e) => setPrefs({ ...prefs, product_updates: e.target.checked })} />
          <span>{t("notifications.emailProduct")}</span>
        </label>
        <label className="ac-check">
          <input type="checkbox" checked={prefs.marketing_email} onChange={(e) => setPrefs({ ...prefs, marketing_email: e.target.checked })} />
          <span>{t("notifications.emailMarketing")}</span>
        </label>
        <label className="ac-check">
          <input type="checkbox" checked={prefs.dm_notifications} onChange={(e) => setPrefs({ ...prefs, dm_notifications: e.target.checked })} />
          <span>DM notifications</span>
        </label>
        <label className="ac-check">
          <input type="checkbox" checked={prefs.community_notifications} onChange={(e) => setPrefs({ ...prefs, community_notifications: e.target.checked })} />
          <span>Community notifications</span>
        </label>
        <FormStatus tone="success" message={message} />
        <FormStatus tone="error" message={error} />
        <button className="ac-btn ac-btn--primary" type="submit" disabled={saving}>
          {saving ? t("form.working") : t("common.save")}
        </button>
      </form>
    </section>
  );
}
