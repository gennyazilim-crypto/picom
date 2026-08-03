import type { UiLanguage } from "../../services/settingsService";
import { useEffect, useState } from "react";
import { appConfig } from "../../config/appConfig";
import { dateTimeService } from "../../services/dateTimeService";
import { externalLinkService } from "../../services/desktop/externalLinkService";
import { updateService, type UpdateServiceState } from "../../services/updateService";
import { translateSettings } from "../../services/settings/settingsI18n";
import { settingsService } from "../../services/settingsService";

type UpdateSettingsSectionProps = {
  language?: UiLanguage;
  onOpenAdvanced: () => void;
  onNotice?: (message: string, tone?: "info" | "success" | "error") => void;
};

function statusLabel(status: UpdateServiceState["status"] | undefined): string {
  return (status ?? "idle").split("_").join(" ");
}

export function UpdateSettingsSection({ language, onOpenAdvanced, onNotice }: UpdateSettingsSectionProps) {
  const lang = language ?? settingsService.getSettings().appearanceSettings.language;
  const t = (key: Parameters<typeof translateSettings>[0], params?: Record<string, string | number>) =>
    translateSettings(key, lang, params);

  const [updateState, setUpdateState] = useState<UpdateServiceState>(() => {
    try {
      return updateService.getState();
    } catch {
      return {
        status: "idle",
        appVersion: appConfig.version,
        availableVersion: null,
        releaseChannel: appConfig.releaseChannel,
        autoUpdateEnabled: false,
        message: t("update.statusLoadFailed"),
        checkedAt: null,
        progress: null,
      };
    }
  });

  useEffect(() => {
    try {
      updateService.connectNativeUpdates();
      return updateService.onStateChange(setUpdateState);
    } catch {
      setUpdateState((prev) => ({
        ...prev,
        message: t("update.listenersFailed"),
      }));
      return undefined;
    }
  }, [lang]);

  const nativeAvailable = (() => {
    try {
      return updateService.isNativeUpdaterAvailable();
    } catch {
      return false;
    }
  })();

  const checkForUpdatesNow = async () => {
    try {
      const next = await updateService.checkForUpdates();
      setUpdateState(next);
      onNotice?.(next.message, next.status === "download_failed" || next.status === "install_failed" || next.status === "error" ? "error" : "info");
    } catch {
      const message = t("update.checkFailed");
      setUpdateState((prev) => ({
        ...prev,
        status: "error",
        message,
        progress: null,
      }));
      onNotice?.(message, "error");
    }
  };

  const simulateFailure = (kind: "download" | "install" | "error") => {
    const next =
      kind === "download"
        ? updateService.setDownloadFailedPlaceholder()
        : kind === "install"
          ? updateService.setInstallFailedPlaceholder()
          : updateService.setErrorPlaceholder();
    setUpdateState(next);
    onNotice?.(next.message, next.status === "download_failed" || next.status === "install_failed" || next.status === "error" ? "error" : "info");
  };

  const availableSuffix = updateState.availableVersion
    ? t("update.availableSuffix", { version: updateState.availableVersion })
    : "";

  return (
    <div className="advanced-settings-stack">
      <p className="settings-section-description">{t("update.description")}</p>

      {!nativeAvailable ? (
        <div className="settings-status-card settings-feature-card" role="status" aria-label={t("update.browserPreviewAria")}>
          <span>{t("update.desktopUpdater")}</span>
          <strong>{t("update.browserPreviewTitle")}</strong>
          <small>{t("update.browserPreviewBody")}</small>
        </div>
      ) : null}

      <section className="advanced-settings-section">
        <h3 className="advanced-settings-section-title">{t("update.sectionTitle")}</h3>
        <div className="settings-status-card settings-feature-card settings-feature-card--highlight" aria-label={t("update.statusCardAria")}>
          <span>{t("update.statusLabel")}</span>
          <strong>{statusLabel(updateState.status)}</strong>
          <small>{updateState.message}</small>
          <small>
            {t("update.installedSummary", {
              version: updateState.appVersion,
              channel: updateState.releaseChannel,
              available: availableSuffix,
            })}
          </small>
          {updateState.checkedAt ? <small>{t("update.lastChecked", { when: dateTimeService.formatFullTimestamp(updateState.checkedAt) })}</small> : null}
          {updateState.progress !== null && updateState.progress !== undefined ? (
            <small>{t("update.downloadProgress", { percent: updateState.progress })}</small>
          ) : null}
        </div>
        <div className="security-card-grid" aria-label={t("update.channelSummaryAria")}>
          <article className="security-card">
            <span>{t("update.currentVersion")}</span>
            <strong>{updateState.appVersion}</strong>
            <small>{appConfig.build.commitShort} · {appConfig.build.date}</small>
          </article>
          <article className="security-card">
            <span>{t("update.channel")}</span>
            <strong>{updateState.releaseChannel}</strong>
            <small>{updateState.autoUpdateEnabled ? t("update.autoUpdateEnabled") : t("update.manualCheckHint")}</small>
          </article>
          <article className="security-card">
            <span>{t("update.nativeUpdater")}</span>
            <strong>{nativeAvailable ? t("update.connected") : t("update.previewOnly")}</strong>
            <small>{t("update.nativeBridgeHint")}</small>
          </article>
        </div>
        <div className="settings-actions-row">
          <button
            type="button"
            className="settings-inline-action"
            disabled={updateState.status === "checking" || updateState.status === "downloading"}
            onClick={() => void checkForUpdatesNow()}
          >
            {updateState.status === "checking" ? t("update.checking") : t("update.checkForUpdates")}
          </button>
          {updateState.status === "available" || updateState.status === "download_failed" ? (
            <button type="button" className="settings-inline-action" onClick={() => void updateService.downloadUpdate().then(setUpdateState)}>
              {updateState.status === "download_failed" ? t("update.retryDownload") : t("update.downloadUpdate")}
            </button>
          ) : null}
          {updateState.status === "ready_to_install" ? (
            <button type="button" className="settings-inline-action" onClick={() => void updateService.installUpdate().then(setUpdateState)}>
              {t("update.restartInstall")}
            </button>
          ) : null}
          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setUpdateState(updateService.retry())}>
            {t("update.retry")}
          </button>
          <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setUpdateState(updateService.clearError())}>
            {t("update.clearError")}
          </button>
        </div>
        {import.meta.env.DEV ? (
          <div className="settings-actions-row">
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setUpdateState(updateService.setAvailablePlaceholder())}>Simulate available</button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setUpdateState(updateService.startDownloadPlaceholder())}>Simulate download</button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setUpdateState(updateService.setReadyToInstallPlaceholder())}>Simulate ready</button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => simulateFailure("download")}>Simulate download failure</button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => simulateFailure("install")}>Simulate install failure</button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => simulateFailure("error")}>Simulate error</button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={() => setUpdateState(updateService.setRollbackAvailablePlaceholder())}>Simulate rollback</button>
          </div>
        ) : null}
      </section>

      <section className="advanced-settings-section">
        <h3 className="advanced-settings-section-title">{t("update.releaseNotesTitle")}</h3>
        <div className="settings-status-card settings-feature-card" aria-label={t("update.releaseNotesTitle")}>
          <span>{t("update.changelog")}</span>
          <strong>{t("update.changelogStrong")}</strong>
          <small>{t("update.changelogHint")}</small>
          <div className="settings-actions-row">
            <button
              type="button"
              className="settings-inline-action settings-inline-action--ghost"
              onClick={() => {
                void externalLinkService.openExternalUrl("https://picom.gg/changelog");
              }}
            >
              {t("update.openChangelog")}
            </button>
            <button type="button" className="settings-inline-action settings-inline-action--ghost" onClick={onOpenAdvanced}>
              {t("update.aboutBuild")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
