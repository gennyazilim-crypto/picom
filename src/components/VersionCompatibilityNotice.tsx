import { useState } from "react";
import { useVersionCompatibility } from "../hooks/useVersionCompatibility";
import { versionCompatibilityService } from "../services/versionCompatibilityService";
import { useTranslation } from "../i18n";
import { AppIcon } from "./AppIcon";
import "./VersionCompatibilityNotice.css";

// Surfaces the wired version-compatibility gate:
// - update_required -> a blocking overlay (only when a real remote config confirmed it, so a
//   missing/offline/default config can never brick the app).
// - update_recommended -> a dismissible banner.
export function VersionCompatibilityNotice() {
  const snapshot = useVersionCompatibility();
  const { t } = useTranslation("common");
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const mustUpdate = snapshot.status === "update_required" && snapshot.source === "remote";
  if (mustUpdate) {
    return (
      <div
        className="version-gate-overlay"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="version-gate-title"
        data-version-gate="required"
      >
        <div className="version-gate-card">
          <div className="version-gate-badge"><AppIcon name="bell" size="lg" /></div>
          <h2 id="version-gate-title">{t("versionGate.title")}</h2>
          <p>{t("versionGate.messageRequired")}</p>
          <dl className="version-gate-meta">
            <div><dt>{t("versionGate.currentVersion")}</dt><dd>{snapshot.currentVersion}</dd></div>
            <div><dt>{t("versionGate.minimumSupported")}</dt><dd>{snapshot.minimumSupportedVersion}</dd></div>
            <div><dt>{t("versionGate.latest")}</dt><dd>{snapshot.latestVersion}</dd></div>
          </dl>
          <p className="version-gate-hint">{t("versionGate.hintDownload")}</p>
          {refreshFailed ? <p className="version-gate-hint">{t("versionGate.messageUnknown")}</p> : null}
          <button
            type="button"
            className="version-gate-retry"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              setRefreshFailed(false);
              void versionCompatibilityService.refreshRemoteConfig()
                .catch(() => {
                  setRefreshFailed(true);
                })
                .finally(() => {
                  setRefreshing(false);
                });
            }}
          >
            {t("action.tryAgain")}
          </button>
        </div>
      </div>
    );
  }

  if (snapshot.status === "update_recommended" && !dismissed) {
    return (
      <div className="version-gate-banner" role="status" data-version-gate="recommended">
        <AppIcon name="bell" size="sm" />
        <span>{t("versionGate.messageRecommended")} ({t("versionGate.latest")} {snapshot.latestVersion})</span>
        <button type="button" className="version-gate-dismiss" onClick={() => setDismissed(true)} aria-label={t("action.dismiss")}>
          <AppIcon name="close" size="xs" />
        </button>
      </div>
    );
  }

  return null;
}
