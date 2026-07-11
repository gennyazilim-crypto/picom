import type { SafeModeState } from "../services/safeModeService";

type SafeModeBannerProps = {
  state: SafeModeState;
  onResetSettings: () => void;
  onClearCache: () => void;
  onExportLogs: () => void;
  onRestartNormally: () => void;
};

function getSafeModeReasonLabel(reason: SafeModeState["reason"]): string {
  if (reason === "query_flag") return "Safe mode flag was detected.";
  if (reason === "manual_flag") return "Safe mode was enabled manually.";
  if (reason === "repeated_startup_crash") return "Repeated startup crashes were detected.";
  if (reason === "corrupted_local_settings") return "Corrupted local settings were reset to safe defaults.";
  if (reason === "local_data_migration_failed") return "Local data migration could not complete safely.";
  return "Optional services are paused.";
}

export function SafeModeBanner({
  state,
  onResetSettings,
  onClearCache,
  onExportLogs,
  onRestartNormally,
}: SafeModeBannerProps) {
  if (!state.active) return null;

  return (
    <section className="safe-mode-banner" role="status" aria-live="polite">
      <div>
        <strong>Safe Mode</strong>
        <span>{getSafeModeReasonLabel(state.reason)} Basic desktop UI is running with optional services disabled.</span>
        <small>{state.disabledServices.join(" | ")}</small>
      </div>
      <div className="safe-mode-actions">
        <button type="button" onClick={onResetSettings}>Reset settings</button>
        <button type="button" onClick={onClearCache}>Clear cache</button>
        <button type="button" onClick={onExportLogs}>Export logs</button>
        <button type="button" onClick={onRestartNormally}>Restart normally</button>
      </div>
    </section>
  );
}
