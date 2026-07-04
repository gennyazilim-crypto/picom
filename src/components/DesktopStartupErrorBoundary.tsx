import { Component, type ErrorInfo, type ReactNode } from "react";
import { loggingService } from "../services/loggingService";

type DesktopStartupErrorBoundaryProps = {
  children: ReactNode;
};

type DesktopStartupErrorBoundaryState = {
  error: Error | null;
};

export class DesktopStartupErrorBoundary extends Component<
  DesktopStartupErrorBoundaryProps,
  DesktopStartupErrorBoundaryState
> {
  state: DesktopStartupErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): DesktopStartupErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    loggingService.captureException(error, {
      componentStack: errorInfo.componentStack,
      source: "DesktopStartupErrorBoundary"
    });
  }

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
          <details>
            <summary>Developer diagnostics</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </section>
      </main>
    );
  }
}