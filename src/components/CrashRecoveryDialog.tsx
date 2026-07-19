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
  const body = record.suspectedUncleanShutdown
    ? "Picom may not have closed cleanly last time. Continue normally, or start with optional services paused."
    : "A previous renderer crash was detected. Your session is intact. Diagnostics stay redacted if you export logs.";

  return (
    <div className="crash-recovery-backdrop" role="presentation">
      <section
        className="crash-recovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crash-recovery-title"
        aria-describedby="crash-recovery-desc"
      >
        <header className="crash-recovery-header">
          <div className="crash-recovery-mark" aria-hidden="true">
            <span className="crash-recovery-mark__glyph">!</span>
          </div>
          <div className="crash-recovery-header-copy">
            <p className="crash-recovery-kicker">Recovery</p>
            <h2 id="crash-recovery-title">Picom recovered from a previous problem</h2>
          </div>
        </header>

        <p id="crash-recovery-desc" className="crash-recovery-copy">
          {body}
        </p>

        <dl className="crash-recovery-meta">
          <div>
            <dt>Detected</dt>
            <dd title={formatRecoveryTime(record.timestamp)}>{formatRecoveryTime(record.timestamp)}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd title={record.errorName}>{record.errorName}</dd>
          </div>
          <div>
            <dt>Log ID</dt>
            <dd title={record.logId}>{record.logId}</dd>
          </div>
        </dl>

        <div className="crash-recovery-actions">
          <button type="button" className="crash-recovery-btn crash-recovery-btn--primary" onClick={onContinue}>
            Continue normally
          </button>
          <div className="crash-recovery-actions__secondary">
            <button type="button" className="crash-recovery-btn" onClick={onSafeMode}>
              Safe Mode
            </button>
            <button type="button" className="crash-recovery-btn" onClick={onExportLogs}>
              Export logs
            </button>
          </div>
          <button type="button" className="crash-recovery-btn crash-recovery-btn--quiet" onClick={onResetSettings}>
            Reset local settings
          </button>
        </div>

        <p className="crash-recovery-footnote">
          Passwords, tokens, cookies, auth headers, and private secrets are redacted before export.
        </p>
      </section>
    </div>
  );
}
