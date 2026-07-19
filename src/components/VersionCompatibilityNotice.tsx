import { useState } from "react";
import { useVersionCompatibility } from "../hooks/useVersionCompatibility";
import { AppIcon } from "./AppIcon";
import "./VersionCompatibilityNotice.css";

// Surfaces the wired version-compatibility gate:
// - update_required -> a blocking overlay (only when a real remote config confirmed it, so a
//   missing/offline/default config can never brick the app).
// - update_recommended -> a dismissible banner.
export function VersionCompatibilityNotice() {
  const snapshot = useVersionCompatibility();
  const [dismissed, setDismissed] = useState(false);

  const mustUpdate = snapshot.status === "update_required" && snapshot.source === "remote";
  if (mustUpdate) {
    return (
      <div className="version-gate-overlay" role="alertdialog" aria-modal="true" aria-labelledby="version-gate-title">
        <div className="version-gate-card">
          <div className="version-gate-badge"><AppIcon name="bell" size="lg" /></div>
          <h2 id="version-gate-title">Update required</h2>
          <p>{snapshot.message}</p>
          <dl className="version-gate-meta">
            <div><dt>Your version</dt><dd>{snapshot.currentVersion}</dd></div>
            <div><dt>Minimum</dt><dd>{snapshot.minimumSupportedVersion}</dd></div>
            <div><dt>Latest</dt><dd>{snapshot.latestVersion}</dd></div>
          </dl>
          <p className="version-gate-hint">Download and install the latest Picom Desktop to continue.</p>
        </div>
      </div>
    );
  }

  if (snapshot.status === "update_recommended" && !dismissed) {
    return (
      <div className="version-gate-banner" role="status">
        <AppIcon name="bell" size="sm" />
        <span>{snapshot.message} (latest {snapshot.latestVersion})</span>
        <button type="button" className="version-gate-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss update notice">
          <AppIcon name="close" size="xs" />
        </button>
      </div>
    );
  }

  return null;
}
