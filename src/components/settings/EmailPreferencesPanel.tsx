import type { UiLanguage } from "../../services/settingsService";
import { useEffect, useState } from "react";
import { emailOperationsService, type EmailPreferences } from "../../services/emailOperationsService";
import { translateSettings, type SettingsI18nKey } from "../../services/settings/settingsI18n";
import { settingsService } from "../../services/settingsService";
import { AppIcon } from "../AppIcon";

type EmailPrefKey = keyof EmailPreferences;

const preferenceRowKeys: readonly Readonly<{
  key: EmailPrefKey;
  titleKey: SettingsI18nKey;
  detailKey: SettingsI18nKey;
  required?: boolean;
}>[] = [
  {
    key: "required_account_security",
    titleKey: "email.row.required_account_security.title",
    detailKey: "email.row.required_account_security.detail",
    required: true,
  },
  { key: "support_updates", titleKey: "email.row.support_updates.title", detailKey: "email.row.support_updates.detail" },
  { key: "community_updates", titleKey: "email.row.community_updates.title", detailKey: "email.row.community_updates.detail" },
  { key: "product_announcements", titleKey: "email.row.product_announcements.title", detailKey: "email.row.product_announcements.detail" },
  { key: "radio_podcast_updates", titleKey: "email.row.radio_podcast_updates.title", detailKey: "email.row.radio_podcast_updates.detail" },
  { key: "optional_digest", titleKey: "email.row.optional_digest.title", detailKey: "email.row.optional_digest.detail" },
  { key: "marketing_advertising", titleKey: "email.row.marketing_advertising.title", detailKey: "email.row.marketing_advertising.detail" },
];

export function EmailPreferencesPanel({ language }: { language?: UiLanguage }) {
  const lang = language ?? settingsService.getSettings().appearanceSettings.language;
  const t = (key: SettingsI18nKey, params?: Record<string, string | number>) => translateSettings(key, lang, params);
  const [preferences, setPreferences] = useState<EmailPreferences | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void emailOperationsService.getPreferences().then((result) => {
      if (!active) return;
      if (!result.ok) { setStatus("error"); setMessage(result.message); return; }
      setPreferences(result.data); setStatus("ready");
    });
    return () => { active = false; };
  }, []);

  const update = async (key: EmailPrefKey, checked: boolean) => {
    if (!preferences || key === "required_account_security" || key === "locale") return;
    const previous = preferences;
    const next = { ...preferences, [key]: checked };
    setPreferences(next); setStatus("saving"); setMessage("");
    const result = await emailOperationsService.updatePreferences({ [key]: checked });
    if (!result.ok) { setPreferences(previous); setStatus("error"); setMessage(result.message); return; }
    setPreferences(result.data); setStatus("ready"); setMessage(t("email.saved"));
  };

  return (
    <section id="notifications-email" className="notification-settings-section" aria-labelledby="email-preferences-title">
      <div className="notification-email-preferences-head">
        <div>
          <h3 id="email-preferences-title" className="notification-settings-section-title">{t("email.title")}</h3>
          <small>{t("email.subtitle")}</small>
        </div>
        <AppIcon name="inbox" size="md" />
      </div>
      {status === "loading" ? <div className="settings-status-card" role="status">{t("email.loading")}</div> : null}
      {preferences ? preferenceRowKeys.map((row) => (
        <label key={row.key} className="settings-toggle-row">
          <span><strong>{t(row.titleKey)}</strong><small>{t(row.detailKey)}</small></span>
          <input
            type="checkbox"
            checked={Boolean(preferences[row.key])}
            disabled={row.required || status === "saving"}
            onChange={(event) => void update(row.key, event.target.checked)}
          />
        </label>
      )) : null}
      {message ? <div role={status === "error" ? "alert" : "status"} className={status === "error" ? "auth-error" : "settings-status-card"}>{message}</div> : null}
    </section>
  );
}
