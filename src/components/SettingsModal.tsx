import { useEffect, useState } from "react";
import { notificationService } from "../services/notificationService";
import { settingsService, type NotificationSettings } from "../services/settingsService";
import { shortcutService } from "../services/shortcutService";
import { trayService } from "../services/trayService";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";

const overlayIcons = mvpUiIconMap.overlays;
type ToastTone = "info" | "error" | "success";

type SettingsModalProps = {
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  onClose: () => void;
  pushToast: (message: string, tone?: ToastTone) => void;
};

export function SettingsModal({ theme, onThemeChange, onClose, pushToast }: SettingsModalProps) {
  const [active, setActive] = useState("Appearance");
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => settingsService.getSettings().notificationSettings);
  const sections = ["Account", "Profile", "Appearance", "Notifications", "Voice & Video", "Keyboard Shortcuts", "Advanced"];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

