import type { UiLanguage } from "../../services/settingsService";
import { useEffect, useState } from "react";
import { translateSettings } from "../../services/settings/settingsI18n";

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
  const desktop = typeof window !== "undefined" ? window.picomDesktop : undefined;
  const [startup, setStartup] = useState<StartupState | null>(null);
  const [closeToTray, setCloseToTray] = useState(true);
  const [rememberBounds, setRememberBounds] = useState(true);
  const [launchMinimized, setLaunchMinimized] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const startupResult = await desktop?.startup?.getState();
      if (!cancelled && startupResult?.ok) {
        setStartup({ supported: startupResult.supported, enabled: startupResult.enabled });
      }
      const local = await desktop?.settings?.get();
      if (!cancelled && local?.ok) {
        setCloseToTray(local.settings.closeToTray !== false);
        setRememberBounds(local.settings.rememberWindowBounds !== false);
        setLaunchMinimized(local.settings.launchMinimized === true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [desktop]);

  const setLaunchOnStartup = async (enabled: boolean) => {
    if (!desktop?.startup?.setEnabled) {
      pushToast(t("error.startupPackagedOnly"), "error");
      return;
    }
    setBusy(true);
    const result = await desktop.startup.setEnabled(enabled);
    setBusy(false);
    if (!result.ok) {
      pushToast(result.error, "error");
      return;
    }
    setStartup({ supported: true, enabled: result.enabled });
    pushToast(t("windows.startupUpdated"), "success");
  };

  const persistLocal = async (partial: Record<string, unknown>) => {
    if (!desktop?.settings?.set) {
      pushToast(t("error.ipcUnavailable"), "error");
      return;
    }
    const result = await desktop.settings.set(partial);
    if (!result.ok) {
      pushToast(result.error, "error");
      return;
    }
    if (typeof partial.closeToTray === "boolean") {
      setCloseToTray(partial.closeToTray);
      await desktop.tray?.setCloseToTray?.(partial.closeToTray);
    }
    if (typeof partial.rememberWindowBounds === "boolean") setRememberBounds(partial.rememberWindowBounds);
    if (typeof partial.launchMinimized === "boolean") setLaunchMinimized(partial.launchMinimized);
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
          disabled={busy || startup?.supported === false || !desktop?.startup}
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
          disabled={!desktop?.settings}
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
          disabled={!desktop?.settings}
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
          disabled={!desktop?.settings}
          onChange={(event) => void persistLocal({ launchMinimized: event.target.checked })}
        />
      </label>
    </div>
  );
}
