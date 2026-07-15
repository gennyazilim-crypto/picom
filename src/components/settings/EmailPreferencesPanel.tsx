import { useEffect, useState } from "react";
import { emailOperationsService, type EmailPreferences } from "../../services/emailOperationsService";
import { AppIcon } from "../AppIcon";

const preferenceRows: readonly Readonly<{ key: keyof EmailPreferences; title: string; detail: string; required?: boolean }>[] = [
  { key: "required_account_security", title: "Account and security", detail: "Required login, recovery, and account-protection messages.", required: true },
  { key: "support_updates", title: "Support updates", detail: "Replies and status changes for requests you submit." },
  { key: "community_updates", title: "Community updates", detail: "Invitations, ownership changes, and important community notices." },
  { key: "product_announcements", title: "Product announcements", detail: "Important Picom product news." },
  { key: "radio_podcast_updates", title: "Radio and podcast updates", detail: "Updates for audio content you follow." },
  { key: "optional_digest", title: "Optional digest", detail: "A compact summary of activity you may have missed." },
  { key: "marketing_advertising", title: "Marketing", detail: "Optional offers and campaigns. Disabled by default." },
];

export function EmailPreferencesPanel() {
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

  const update = async (key: keyof EmailPreferences, checked: boolean) => {
    if (!preferences || key === "required_account_security" || key === "locale") return;
    const previous = preferences;
    const next = { ...preferences, [key]: checked };
    setPreferences(next); setStatus("saving"); setMessage("");
    const result = await emailOperationsService.updatePreferences({ [key]: checked });
    if (!result.ok) { setPreferences(previous); setStatus("error"); setMessage(result.message); return; }
    setPreferences(result.data); setStatus("ready"); setMessage("Email preferences saved.");
  };

  return (
    <section className="notification-settings-section" aria-labelledby="email-preferences-title">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 id="email-preferences-title" className="notification-settings-section-title">Email preferences</h3>
          <small style={{ color: "var(--text-muted)" }}>Control optional email while required security mail remains enabled.</small>
        </div>
        <AppIcon name="inbox" size="md" />
      </div>
      {status === "loading" ? <div className="settings-status-card" role="status">Loading email preferences...</div> : null}
      {preferences ? preferenceRows.map((row) => (
        <label key={row.key} className="settings-toggle-row">
          <span><strong>{row.title}</strong><small>{row.detail}</small></span>
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
