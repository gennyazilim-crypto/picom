import { Component, type ErrorInfo, type ReactNode } from "react";
import { clipboardService } from "../services/clipboardService";
import { crashRecoveryService, type CrashRecoveryRecord } from "../services/crashRecoveryService";
import { loggingService } from "../services/loggingService";
import { safeModeService } from "../services/safeModeService";
import { crashReporterService } from "../services/crashReporterService";
import { AppIcon } from "./AppIcon";

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
    this.setState({ copied: result.ok, actionMessage: result.ok ? "Redacted support details copied." : "Support details could not be copied." });
  };

  private exportLogs = (): void => {
    const result = safeModeService.exportLogs();
    this.setState({ exported: result.ok, actionMessage: result.message });
  };

  private clearRecoveryState = (): void => {
    crashRecoveryService.clearCrashState();
    loggingService.clearLogs();
    this.setState({ cleared: true, copied: false, exported: false, actionMessage: "Local recovery state and logs cleared.", recoveryRecord: null });
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

    return (
      <main className="startup-error-screen" role="alert" aria-live="assertive">
        <section className="startup-error-card" aria-labelledby="startup-error-title">
          <div className="startup-error-mark" aria-hidden="true"><AppIcon name="close" size="lg" /></div>
          <p className="eyebrow">Desktop recovery</p>
          <h1 id="startup-error-title">Picom needs a restart</h1>
          <p>Your current workspace view stopped unexpectedly. Your account data and signed-in session were not changed.</p>
          <div className="startup-error-guidance">
            <strong>Start with a normal restart.</strong>
            <span>If the problem returns, open Safe Mode to pause optional desktop services, then export logs for support.</span>
          </div>
          {this.state.recoveryRecord ? <p className="startup-error-meta">A redacted recovery record was saved locally.</p> : null}
          <div className="startup-error-actions">
            <button type="button" className="primary" onClick={this.restartRenderer}>
              Restart Picom
            </button>
            <button type="button" onClick={this.restartInSafeMode}>
              Open Safe Mode
            </button>
            <button type="button" onClick={this.exportLogs}>
              {this.state.exported ? "Logs exported" : "Export support logs"}
            </button>
            <button type="button" onClick={this.copyDiagnostics}>
              {this.state.copied ? "Support details copied" : "Copy support details"}
            </button>
          </div>
          {this.state.actionMessage ? <p className="startup-error-status" role="status">{this.state.actionMessage}</p> : null}
          {import.meta.env.DEV ? (
            <details>
              <summary>Developer diagnostics (local development only)</summary>
              <pre>{JSON.stringify(developerDiagnostics, null, 2)}</pre>
              <button type="button" className="startup-error-clear" onClick={this.clearRecoveryState}>{this.state.cleared ? "Recovery state cleared" : "Clear local recovery state"}</button>
            </details>
          ) : null}
        </section>
      </main>
    );
  }
}
