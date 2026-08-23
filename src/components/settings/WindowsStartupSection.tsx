import type { UiLanguage } from "../../services/settingsService";
import { useEffect, useState } from "react";
import { translateSettings } from "../../services/settings/settingsI18n";
import { startupService } from "../../services/startupService";
import { desktopBehaviorService } from "../../services/desktop/desktopBehaviorService";

type StartupState = Readonly<{ supported: boolean; enabled: boolean }>;

export function WindowsStartupSection({
  language,
  pushToast,
}: Readonly<{
  language: UiLanguage;
  pushToast: (message: string, tone?: "info" | "success" | "error") => void;
}>) {
  const t = (key: Parameters<typeof translateSettings>[0], params?: Record<string, string | number>) =>
    translateSettings(key, language, params);
  const [startup, setStartup] = useState<StartupState | null>(null);
  const [closeToTray, setCloseToTray] = useState(true);
  const [trayAvailable, setTrayAvailable] = useState(false);
  const [rememberBounds, setRememberBounds] = useState(true);
  const [launchMinimized, setLaunchMinimized] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const startupResult = await startupService.refreshNativeState();
      const behavior = await desktopBehaviorService.refresh();
      if (!cancelled) {
        setStartup({ supported: startupResult.mode === "native_ready", enabled: startupResult.launchOnStartup });
        setCloseToTray(behavior.closeBehavior === "tray");
        setTrayAvailable(behavior.trayAvailable);
        setLaunchMinimized(behavior.startupVisibility === "tray");
      }
      const local = await window.picomDesktop?.settings?.get();
      if (!cancelled && local?.ok) {
        setRememberBounds(local.settings.rememberWindowBounds !== false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLaunchOnStartup = async (enabled: boolean) => {
    setBusy(true);
    const result = await startupService.setLaunchOnStartupEnabled(enabled);
    setBusy(false);
    if (result.error || result.launchOnStartup !== enabled) {
      pushToast(result.error ?? t("error.startupPackagedOnly"), "error");
      return;
    }
    setStartup({ supported: true, enabled: result.launchOnStartup });
    pushToast(t("windows.startupUpdated"), "success");
  };

  const persistLocal = async (partial: Record<string, unknown>) => {
    if (typeof partial.closeToTray === "boolean") {
      const behavior = await desktopBehaviorService.updatePreferences({ closeBehavior: partial.closeToTray ? "tray" : "quit" });
      if (behavior.closeBehavior !== (partial.closeToTray ? "tray" : "quit")) {
        pushToast(t("error.ipcUnavailable"), "error");
        return;
      }
      setCloseToTray(behavior.closeBehavior === "tray");
    }
    if (typeof partial.launchMinimized === "boolean") {
      const behavior = await desktopBehaviorService.updatePreferences({ startupVisibility: partial.launchMinimized ? "tray" : "normal" });
      if (behavior.startupVisibility !== (partial.launchMinimized ? "tray" : "normal")) {
        pushToast(t("error.ipcUnavailable"), "error");
        return;
      }
      setLaunchMinimized(behavior.startupVisibility === "tray");
    }
    if (typeof partial.rememberWindowBounds === "boolean") {
      const result = await window.picomDesktop?.settings?.set?.(partial);
      if (!result?.ok) {
        pushToast(t("error.ipcUnavailable"), "error");
        return;
      }
      setRememberBounds(partial.rememberWindowBounds);
    }
  };

  return (
    <div className="account-settings-stack" id="settings-windows-startup">
      <p className="settings-section-description">{t("windows.description")}</p>
      <label className="settings-toggle-row">
        <span>
          <strong>{t("windows.launchOnStartup")}</strong>
          <small>
            {startup?.supported === false ? t("windows.launchHintPackaged") : t("windows.launchHintSignIn")}
          </small>
        </span>
        <input
          type="checkbox"
          checked={Boolean(startup?.enabled)}
          disabled={busy || startup?.supported === false}
          onChange={(event) => void setLaunchOnStartup(event.target.checked)}
        />
      </label>
      <label className="settings-toggle-row">
        <span>
          <strong>{t("windows.closeToTray")}</strong>
          <small>{t("windows.closeToTrayHint")}</small>
        </span>
        <input
          type="checkbox"
          checked={closeToTray}
          disabled={!trayAvailable}
          onChange={(event) => void persistLocal({ closeToTray: event.target.checked })}
        />
      </label>
      <label className="settings-toggle-row">
        <span>
          <strong>{t("windows.rememberBounds")}</strong>
          <small>{t("windows.rememberBoundsHint")}</small>
        </span>
        <input
          type="checkbox"
          checked={rememberBounds}
          disabled={!window.picomDesktop?.settings}
          onChange={(event) => void persistLocal({ rememberWindowBounds: event.target.checked })}
        />
      </label>
      <label className="settings-toggle-row">
        <span>
          <strong>{t("windows.startMinimized")}</strong>
          <small>{t("windows.startMinimizedHint")}</small>
        </span>
        <input
          type="checkbox"
          checked={launchMinimized}
          disabled={!trayAvailable || startup?.supported === false}
          onChange={(event) => void persistLocal({ launchMinimized: event.target.checked })}
        />
      </label>
    </div>
  );
}
