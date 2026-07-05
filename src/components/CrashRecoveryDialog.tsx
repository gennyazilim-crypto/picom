import type { CrashRecoveryRecord } from "../services/crashRecoveryService";

type CrashRecoveryDialogProps = {
  record: CrashRecoveryRecord;
  onContinue: () => void;
  onSafeMode: () => void;
  onExportLogs: () => void;
  onResetSettings: () => void;
};

function formatRecoveryTime(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function CrashRecoveryDialog({
  record,
  onContinue,
  onSafeMode,
  onExportLogs,
  onResetSettings,
}: CrashRecoveryDialogProps) {
  return (
    <div className="crash-recovery-backdrop" role="presentation">
      <section className="crash-recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="crash-recovery-title">
        <div className="crash-recovery-mark">!</div>
        <p className="eyebrow">Recovery</p>
        <h2 id="crash-recovery-title">Picom recovered from a previous problem</h2>
        <p>
          {record.suspectedUncleanShutdown
            ? "Picom may not have closed cleanly last time. You can continue normally or start with optional services paused."
            : "A previous renderer crash was detected. Your account session is preserved, and diagnostics are redacted before export."}
        </p>
        <dl className="crash-recovery-meta">
          <div>
            <dt>Detected</dt>
            <dd>{formatRecoveryTime(record.timestamp)}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{record.errorName}</dd>
          </div>
          <div>
            <dt>Log ID</dt>
            <dd>{record.logId}</dd>
          </div>
        </dl>
        <div className="crash-recovery-actions">
          <button type="button" className="primary" onClick={onContinue}>
            Continue normally
          </button>
          <button type="button" onClick={onSafeMode}>
            Safe Mode
          </button>
          <button type="button" onClick={onExportLogs}>
            Export logs
          </button>
          <button type="button" onClick={onResetSettings}>
            Reset local settings
          </button>
        </div>
        <small>Passwords, tokens, cookies, auth headers, and private secrets are redacted by the logging service.</small>
      </section>
    </div>
  );
}
