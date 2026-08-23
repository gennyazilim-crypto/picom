import { Component, type ErrorInfo, type ReactNode } from "react";
import { clipboardService } from "../services/clipboardService";
import { crashRecoveryService, type CrashRecoveryRecord } from "../services/crashRecoveryService";
import { loggingService } from "../services/loggingService";
import { safeModeService } from "../services/safeModeService";
import { crashReporterService } from "../services/crashReporterService";
import { AppIcon } from "./AppIcon";
import { useTranslation } from "../i18n";

type DesktopStartupErrorBoundaryProps = {
  children: ReactNode;
};

type DesktopStartupErrorBoundaryState = {
  error: Error | null;
  copied: boolean;
  exported: boolean;
  cleared: boolean;
  actionMessage: string | null;
  recoveryRecord: CrashRecoveryRecord | null;
};

type StartupErrorContentProps = Readonly<{
  copied: boolean;
  exported: boolean;
  cleared: boolean;
  actionMessage: string | null;
  recoveryRecord: CrashRecoveryRecord | null;
  developerDiagnostics: unknown;
  onRestart: () => void;
  onOpenSafeMode: () => void;
  onExportLogs: () => void;
  onCopyDiagnostics: () => void;
  onClearRecoveryState: () => void;
}>;

function StartupErrorContent({ copied, exported, cleared, actionMessage, recoveryRecord, developerDiagnostics, onRestart, onOpenSafeMode, onExportLogs, onCopyDiagnostics, onClearRecoveryState }: StartupErrorContentProps) {
  const { t } = useTranslation("errors");
  return (
    <main className="startup-error-screen" role="alert" aria-live="assertive">
      <section className="startup-error-card" aria-labelledby="startup-error-title">
        <div className="startup-error-mark" aria-hidden="true"><AppIcon name="close" size="lg" /></div>
        <p className="eyebrow">{t("startup.kicker")}</p>
        <h1 id="startup-error-title">{t("startup.title")}</h1>
        <p>{t("startup.body")}</p>
        <div className="startup-error-guidance">
          <strong>{t("startup.guidanceTitle")}</strong>
          <span>{t("startup.guidanceBody")}</span>
        </div>
        {recoveryRecord ? <p className="startup-error-meta">{t("startup.recordSaved")}</p> : null}
        <div className="startup-error-actions">
          <button type="button" className="primary" onClick={onRestart}>{t("startup.restart")}</button>
          <button type="button" onClick={onOpenSafeMode}>{t("startup.safeMode")}</button>
          <button type="button" onClick={onExportLogs}>{exported ? t("startup.logsExported") : t("startup.exportLogs")}</button>
          <button type="button" onClick={onCopyDiagnostics}>{copied ? t("startup.detailsCopied") : t("startup.copyDetails")}</button>
        </div>
        {actionMessage ? <p className="startup-error-status" role="status">{t(actionMessage)}</p> : null}
        {import.meta.env.DEV ? (
          <details>
            <summary>{t("startup.developerDiagnostics")}</summary>
            <pre>{JSON.stringify(developerDiagnostics, null, 2)}</pre>
            <button type="button" className="startup-error-clear" onClick={onClearRecoveryState}>{cleared ? t("startup.recoveryCleared") : t("startup.clearRecovery")}</button>
          </details>
        ) : null}
      </section>
    </main>
  );
}

export class DesktopStartupErrorBoundary extends Component<
  DesktopStartupErrorBoundaryProps,
  DesktopStartupErrorBoundaryState
> {
  state: DesktopStartupErrorBoundaryState = {
    error: null,
    copied: false,
    exported: false,
    cleared: false,
    actionMessage: null,
    recoveryRecord: crashRecoveryService.getLastCrash()
  };

  static getDerivedStateFromError(error: Error): DesktopStartupErrorBoundaryState {
    return {
      error,
      copied: false,
      exported: false,
      cleared: false,
      actionMessage: null,
      recoveryRecord: crashRecoveryService.getLastCrash()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const logEntry = loggingService.captureException(error, {
      componentStack: errorInfo.componentStack,
      source: "DesktopStartupErrorBoundary"
    });
    crashReporterService.captureException(error, { componentStack: errorInfo.componentStack, source: "DesktopStartupErrorBoundary" });

    this.setState({
      recoveryRecord: crashRecoveryService.recordCrash(error, logEntry)
    });
    safeModeService.recordStartupCrash();
  }

  private copyDiagnostics = async (): Promise<void> => {
    const result = await clipboardService.copyText(crashRecoveryService.getDiagnosticsText());
    this.setState({ copied: result.ok, actionMessage: result.ok ? "startup.detailsCopied" : "startup.copyDetails" });
  };

  private exportLogs = (): void => {
    const result = safeModeService.exportLogs();
    this.setState({ exported: result.ok, actionMessage: result.ok ? "startup.logsExported" : "startup.exportLogs" });
  };

  private clearRecoveryState = (): void => {
    crashRecoveryService.clearCrashState();
    loggingService.clearLogs();
    this.setState({ cleared: true, copied: false, exported: false, actionMessage: "startup.recoveryCleared", recoveryRecord: null });
  };

  private restartRenderer = (): void => {
    crashRecoveryService.restartRenderer();
  };

  private restartInSafeMode = (): void => {
    safeModeService.enableSafeMode("manual_flag");
    crashRecoveryService.restartRenderer();
  };

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    const developerDiagnostics = import.meta.env.DEV
      ? loggingService.redactDiagnosticsValue({
          error: {
            name: this.state.error.name,
            message: this.state.error.message,
            stack: this.state.error.stack
          },
          recoveryRecord: this.state.recoveryRecord
        })
      : null;

    return <StartupErrorContent copied={this.state.copied} exported={this.state.exported} cleared={this.state.cleared} actionMessage={this.state.actionMessage} recoveryRecord={this.state.recoveryRecord} developerDiagnostics={developerDiagnostics} onRestart={this.restartRenderer} onOpenSafeMode={this.restartInSafeMode} onExportLogs={this.exportLogs} onCopyDiagnostics={this.copyDiagnostics} onClearRecoveryState={this.clearRecoveryState} />;
  }
}
