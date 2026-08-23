import type { CrashRecoveryRecord } from "../services/crashRecoveryService";
import { useTranslation } from "../i18n";

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
  const { t } = useTranslation("errors");
  const body = record.suspectedUncleanShutdown
    ? t("recovery.uncleanBody")
    : t("recovery.crashBody");

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
          <p className="crash-recovery-kicker">{t("recovery.kicker")}</p>
          <h2 id="crash-recovery-title">{t("recovery.title")}</h2>
          </div>
        </header>

        <p id="crash-recovery-desc" className="crash-recovery-copy">
          {body}
        </p>

        <dl className="crash-recovery-meta">
          <div>
            <dt>{t("recovery.detected")}</dt>
            <dd title={formatRecoveryTime(record.timestamp)}>{formatRecoveryTime(record.timestamp)}</dd>
          </div>
          <div>
            <dt>{t("recovery.type")}</dt>
            <dd title={record.errorName}>{record.errorName}</dd>
          </div>
          <div>
            <dt>{t("recovery.logId")}</dt>
            <dd title={record.logId}>{record.logId}</dd>
          </div>
        </dl>

        <div className="crash-recovery-actions">
          <button type="button" className="crash-recovery-btn crash-recovery-btn--primary" onClick={onContinue}>
            {t("recovery.continue")}
          </button>
          <div className="crash-recovery-actions__secondary">
            <button type="button" className="crash-recovery-btn" onClick={onSafeMode}>
              {t("recovery.safeMode")}
            </button>
            <button type="button" className="crash-recovery-btn" onClick={onExportLogs}>
              {t("recovery.exportLogs")}
            </button>
          </div>
          <button type="button" className="crash-recovery-btn crash-recovery-btn--quiet" onClick={onResetSettings}>
            {t("recovery.resetSettings")}
          </button>
        </div>

        <p className="crash-recovery-footnote">
          {t("recovery.footnote")}
        </p>
      </section>
    </div>
  );
}
