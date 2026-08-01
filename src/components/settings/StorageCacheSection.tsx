import { useCallback, useEffect, useState } from "react";
import { settingsService } from "../../services/settingsService";
import { translateSettings } from "../../services/settings/settingsI18n";

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function StorageCacheSection({
  language,
  pushToast,
}: Readonly<{
  language: "en" | "tr";
  pushToast: (message: string, tone?: "info" | "success" | "error") => void;
}>) {
  const t = (key: Parameters<typeof translateSettings>[0], params?: Record<string, string | number>) =>
    translateSettings(key, language, params);
  const desktop = typeof window !== "undefined" ? window.picomDesktop : undefined;
  const [usage, setUsage] = useState<{
    userDataBytes: number;
    cacheBytes: number;
    logsBytes: number;
    tempBytes: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const result = await desktop?.cache?.getUsage();
    if (result?.ok) setUsage(result.usage);
  }, [desktop]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearCache = async (scope: "all" | "media") => {
    if (!desktop?.cache?.clear) {
      pushToast(t("error.cacheClearIpc"), "error");
      return;
    }
    const confirmed = window.confirm(
      scope === "media" ? t("storage.confirmClearMedia") : t("storage.confirmClearCache"),
    );
    if (!confirmed) return;
    setBusy(true);
    const result = await desktop.cache.clear(scope);
    setBusy(false);
    if (!result.ok) {
      pushToast(result.error, "error");
      return;
    }
    setUsage(result.usage);
    pushToast(t("storage.cleared"), "success");
  };

  const resetLocalSettings = () => {
    const confirmed = window.confirm(t("storage.confirmResetLocal"));
    if (!confirmed) return;
    settingsService.resetSettings();
    void desktop?.settings?.reset();
    pushToast(t("storage.resetDone"), "success");
  };

  return (
    <div className="account-settings-stack" id="settings-storage-cache">
      <p className="settings-section-description">{t("storage.description")}</p>
      <div className="settings-status-card settings-feature-card" aria-live="polite">
        <strong>{t("storage.summary")}</strong>
        <small>{t("storage.totalUserData")}: {formatBytes(usage?.userDataBytes ?? 0)}</small>
        <small>{t("storage.cacheLabel")}: {formatBytes(usage?.cacheBytes ?? 0)}</small>
        <small>{t("storage.logsLabel")}: {formatBytes(usage?.logsBytes ?? 0)}</small>
        <small>{t("storage.tempLabel")}: {formatBytes(usage?.tempBytes ?? 0)}</small>
        <div className="settings-actions-row settings-actions-row--wrap">
          <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={busy} onClick={() => void refresh()}>
            {t("storage.recalculate")}
          </button>
          <button type="button" className="settings-inline-action" disabled={busy || !desktop?.cache} onClick={() => void clearCache("media")}>
            {t("storage.clearMedia")}
          </button>
          <button type="button" className="settings-inline-action" disabled={busy || !desktop?.cache} onClick={() => void clearCache("all")}>
            {t("storage.clearCache")}
          </button>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={!desktop?.appPaths} onClick={() => void desktop?.appPaths?.open("logs")}>
            {t("storage.openLogs")}
          </button>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" disabled={!desktop?.appPaths} onClick={() => void desktop?.appPaths?.open("downloads")}>
            {t("storage.openDownloads")}
          </button>
          <button type="button" className="settings-inline-action settings-inline-action--danger" onClick={resetLocalSettings}>
            {t("storage.resetLocal")}
          </button>
        </div>
      </div>
    </div>
  );
}
