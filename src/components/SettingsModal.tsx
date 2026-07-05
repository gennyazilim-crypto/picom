import { useEffect, useState } from "react";
import { notificationService } from "../services/notificationService";
import { feedbackService, type FeedbackIssueType } from "../services/feedbackService";
import { settingsService, type NotificationSettings, type ProfileSettings } from "../services/settingsService";
import { shortcutService } from "../services/shortcutService";
import { trayService } from "../services/trayService";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const overlayIcons = mvpUiIconMap.overlays;
type ToastTone = "info" | "error" | "success";

type SettingsModalProps = {
  theme: "light" | "dark";
  profileSettings: ProfileSettings;
  onThemeChange: (theme: "light" | "dark") => void;
  onProfileSettingsChange: (settings: ProfileSettings) => void;
  onClose: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
};

export function SettingsModal({ theme, profileSettings, onThemeChange, onProfileSettingsChange, onClose, pushToast }: SettingsModalProps) {
  const [active, setActive] = useState("Appearance");
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => settingsService.getSettings().notificationSettings);
  const [profileDraft, setProfileDraft] = useState<ProfileSettings>(profileSettings);
  const [feedbackIssueType, setFeedbackIssueType] = useState<FeedbackIssueType>("bug");
  const [feedbackTitle, setFeedbackTitle] = useState("Beta feedback placeholder");
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [includeLogs, setIncludeLogs] = useState(false);
  const sections = ["Account", "Profile", "Appearance", "Notifications", "Voice & Video", "Keyboard Shortcuts", "Advanced"];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setProfileDraft(profileSettings);
  }, [profileSettings]);

  const testNotification = async () => {
    const result = await notificationService.showTestNotification();
    pushToast(result.ok ? "Notification placeholder sent." : result.reason ?? "Notification unavailable.", result.ok ? "success" : "error");
  };
  const notificationStatus = notificationService.getStatus();
  const updateNotifications = (partial: Partial<NotificationSettings>) => {
    const next = settingsService.updateNotificationSettings(partial).notificationSettings;
    setNotificationSettings(next);
    pushToast("Notification setting saved locally.", "success");
  };
  const saveProfileSettings = () => {
    const next = settingsService.updateProfileSettings({
      displayName: profileDraft.displayName.trim(),
      statusText: profileDraft.statusText.trim(),
      bio: profileDraft.bio.trim(),
    }).profileSettings;
    onProfileSettingsChange(next);
    pushToast("Profile changes saved locally.", "success");
  };
  const resetProfileSettings = () => {
    const next = settingsService.updateProfileSettings({ displayName: "", statusText: "", bio: "" }).profileSettings;
    setProfileDraft(next);
    onProfileSettingsChange(next);
    pushToast("Profile changes reset locally.", "info");
  };
  const createFeedbackDraft = () => ({
    issueType: feedbackIssueType,
    title: feedbackTitle.trim() || "Beta feedback placeholder",
    description: feedbackDescription.trim() || "No description provided.",
    includeDiagnostics,
    includeLogs
  });
  const submitFeedbackPlaceholder = () => {
    const result = feedbackService.submitPlaceholder(createFeedbackDraft());
    pushToast(`${result.message} Ref: ${result.referenceId}`, "success");
  };
  const exportDiagnostics = async () => {
    const result = await feedbackService.exportSupportDiagnostics(createFeedbackDraft());
    if (result.ok) {
      pushToast(result.canceled ? "Diagnostics export canceled." : `Diagnostics exported via ${result.method}.`, result.canceled ? "info" : "success");
      return;
    }

    pushToast(result.reason, "error");
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="settings-modal" onMouseDown={(event) => event.stopPropagation()}>
        <aside className="settings-nav">
          <span className="eyebrow">Settings</span>
          <h2>Picom Desktop</h2>
          <div className="settings-tabs">
            {sections.map((section) => (
              <button key={section} className={active === section ? "active" : ""} onClick={() => setActive(section)}>
                <span className="tab-dot" />{section}
              </button>
            ))}
          </div>
        </aside>
        <main className="settings-content">
          <button className="icon-button modal-close" aria-label="Close settings" onClick={onClose}>
            <AppIcon name={overlayIcons.close} size="lg" />
          </button>
          <span className="eyebrow">{active}</span>
          <h2>{active}</h2>
          {active === "Appearance" ? (
            <div className="theme-grid">
              <button className={`theme-card ${theme === "light" ? "selected" : ""}`} onClick={() => onThemeChange("light")}>
                <span className="theme-preview light-preview" />
                <strong>Light Theme</strong>
                <small>Soft shell with clean white surfaces.</small>
              </button>
              <button className={`theme-card ${theme === "dark" ? "selected" : ""}`} onClick={() => onThemeChange("dark")}>
                <span className="theme-preview dark-preview" />
                <strong>Dark Theme</strong>
                <small>Charcoal shell with separated surfaces.</small>
              </button>
            </div>
          ) : active === "Profile" ? (
            <div className="placeholder-panel action-panel">
              <strong>Local profile editing</strong>
              <p>Changes apply to this desktop profile immediately. Supabase profile persistence is a future backend step.</p>
              <div className="settings-profile-form">
                <label>
                  <span>Display name</span>
                  <input value={profileDraft.displayName} onChange={(event) => setProfileDraft({ ...profileDraft, displayName: event.target.value })} placeholder="Use mock profile name" />
                </label>
                <label>
                  <span>Status text</span>
                  <input value={profileDraft.statusText} onChange={(event) => setProfileDraft({ ...profileDraft, statusText: event.target.value })} placeholder="Use mock status text" />
                </label>
                <label>
                  <span>Bio</span>
                  <textarea value={profileDraft.bio} onChange={(event) => setProfileDraft({ ...profileDraft, bio: event.target.value })} placeholder="Write a short desktop profile bio" rows={4} />
                </label>
              </div>
              <div className="settings-actions-row">
                <button onClick={saveProfileSettings}>Save profile locally</button>
                <button onClick={resetProfileSettings}>Reset local profile</button>
              </div>
            </div>
          ) : active === "Notifications" ? (
            <div className="placeholder-panel action-panel">
              <strong>Native notification foundation</strong>
              <p>Uses a safe browser/native fallback and never calls desktop APIs directly from React.</p>
              <div className="settings-status-card" aria-label="Notification runtime status">
                <span>Runtime support</span>
                <strong>{notificationStatus.supported ? "Available" : "Fallback only"}</strong>
                <small>Permission: {notificationStatus.permission}. Settings are saved locally for this desktop profile.</small>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>Enable desktop notifications</strong>
                  <small>Allow Picom to show native desktop notification placeholders.</small>
                </span>
                <input type="checkbox" checked={notificationSettings.enabled} onChange={(event) => updateNotifications({ enabled: event.target.checked })} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Mute notifications</strong>
                  <small>Keep notifications quiet while preserving inbox foundations later.</small>
                </span>
                <input type="checkbox" checked={notificationSettings.muted} onChange={(event) => updateNotifications({ muted: event.target.checked })} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Mentions only placeholder</strong>
                  <small>Future notification routing can use this preference.</small>
                </span>
                <input type="checkbox" checked={notificationSettings.mentionsOnly} onChange={(event) => updateNotifications({ mentionsOnly: event.target.checked })} />
              </label>
              <button onClick={testNotification}>Send test notification</button>
            </div>
          ) : active === "Keyboard Shortcuts" ? (
            <div className="shortcut-list">
              {shortcutService.bindings.map((binding) => (
                <div key={binding.action}>
                  <strong>{binding.label}</strong>
                  <span>{binding.action}</span>
                </div>
              ))}
            </div>
          ) : active === "Advanced" ? (
            <div className="placeholder-panel action-panel">
              <strong>Desktop service placeholders</strong>
              <p>Tray, window controls, file handling and clipboard are routed through safe services.</p>
              <button onClick={() => { trayService.simulate("settings"); pushToast("Tray settings action simulated.", "info"); }}>Simulate tray settings</button>
              <div className="settings-status-card" aria-label="Beta feedback and logs placeholder">
                <span>Beta support</span>
                <strong>Feedback & logs placeholder</strong>
                <small>User-facing feedback stays separate from redacted developer diagnostics. No report is sent until a backend endpoint is added.</small>
              </div>
              <label className="settings-toggle-row">
                <span>
                  <strong>Issue type</strong>
                  <small>Used only in the local placeholder payload.</small>
                </span>
                <select value={feedbackIssueType} onChange={(event) => setFeedbackIssueType(event.target.value as FeedbackIssueType)}>
                  <option value="bug">Bug</option>
                  <option value="crash">Crash</option>
                  <option value="login">Login</option>
                  <option value="message">Message</option>
                  <option value="upload">Upload</option>
                  <option value="voice">Voice</option>
                  <option value="packaging">Packaging</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <input value={feedbackTitle} onChange={(event) => setFeedbackTitle(event.target.value)} placeholder="Short feedback title" aria-label="Feedback title" />
              <textarea value={feedbackDescription} onChange={(event) => setFeedbackDescription(event.target.value)} placeholder="Describe what happened. Do not include passwords, tokens, or secrets." aria-label="Feedback description" rows={3} />
              <label className="settings-toggle-row">
                <span>
                  <strong>Include diagnostics</strong>
                  <small>Includes app mode, release channel, runtime, and non-sensitive state.</small>
                </span>
                <input type="checkbox" checked={includeDiagnostics} onChange={(event) => setIncludeDiagnostics(event.target.checked)} />
              </label>
              <label className="settings-toggle-row">
                <span>
                  <strong>Include recent redacted logs</strong>
                  <small>Logs are redacted by loggingService before export.</small>
                </span>
                <input type="checkbox" checked={includeLogs} onChange={(event) => setIncludeLogs(event.target.checked)} />
              </label>
              <div className="settings-actions-row">
                <button onClick={submitFeedbackPlaceholder}>Save feedback placeholder</button>
                <button onClick={exportDiagnostics}>Export diagnostics JSON</button>
              </div>
            </div>
          ) : (
            <div className="placeholder-panel">
              <strong>{active} placeholder</strong>
              <p>This MVP keeps the section ready without advanced roadmap work.</p>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}

