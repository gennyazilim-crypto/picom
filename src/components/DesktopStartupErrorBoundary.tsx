import { Component, type ErrorInfo, type ReactNode } from "react";
import { clipboardService } from "../services/clipboardService";
import { crashRecoveryService, type CrashRecoveryRecord } from "../services/crashRecoveryService";
import { loggingService } from "../services/loggingService";

type DesktopStartupErrorBoundaryProps = {
  children: ReactNode;
};

type DesktopStartupErrorBoundaryState = {
  error: Error | null;
  copied: boolean;
  cleared: boolean;
  recoveryRecord: CrashRecoveryRecord | null;
};

export class DesktopStartupErrorBoundary extends Component<
  DesktopStartupErrorBoundaryProps,
  DesktopStartupErrorBoundaryState
> {
  state: DesktopStartupErrorBoundaryState = {
    error: null,
    copied: false,
    cleared: false,
    recoveryRecord: crashRecoveryService.getLastCrash()
  };

  static getDerivedStateFromError(error: Error): DesktopStartupErrorBoundaryState {
    return {
      error,
      copied: false,
      cleared: false,
      recoveryRecord: crashRecoveryService.getLastCrash()
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const logEntry = loggingService.captureException(error, {
      componentStack: errorInfo.componentStack,
      source: "DesktopStartupErrorBoundary"
    });

    this.setState({
      recoveryRecord: crashRecoveryService.recordCrash(error, logEntry)
    });
  }

  private copyDiagnostics = async (): Promise<void> => {
    const result = await clipboardService.copyText(crashRecoveryService.getDiagnosticsText());
    this.setState({ copied: result.ok });
  };

  private clearRecoveryState = (): void => {
    crashRecoveryService.clearCrashState();
    loggingService.clearLogs();
    this.setState({ cleared: true, copied: false, recoveryRecord: null });
  };

  private restartRenderer = (): void => {
    crashRecoveryService.restartRenderer();
  };

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="startup-error-screen" role="alert">
        <section className="startup-error-card" aria-labelledby="startup-error-title">
          <div className="startup-error-mark">!</div>
          <p className="eyebrow">Application error</p>
          <h1 id="startup-error-title">Picom could not finish starting</h1>
          <p>
            The desktop shell caught an unexpected renderer error. You can restart the app or open
            diagnostics later without exposing sensitive data.
          </p>
          <div className="startup-error-actions">
            <button type="button" className="primary" onClick={this.restartRenderer}>
              Restart app view
            </button>
            <button type="button" onClick={this.copyDiagnostics}>
              {this.state.copied ? "Diagnostics copied" : "Copy diagnostics"}
            </button>
            <button type="button" onClick={this.clearRecoveryState}>
              {this.state.cleared ? "Recovery state cleared" : "Clear recovery state"}
            </button>
          </div>
          <details>
            <summary>Developer diagnostics</summary>
            <pre>
              {JSON.stringify(
                {
                  error: this.state.error.message,
                  recoveryRecord: this.state.recoveryRecord
                },
                null,
                2
              )}
            </pre>
          </details>
        </section>
      </main>
    );
  }
}
