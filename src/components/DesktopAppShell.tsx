import type { ReactNode } from "react";
import { AppIcon } from "./AppIcon";

type DesktopAppShellProps = {
  children: ReactNode;
};

export function DesktopAppShell({ children }: DesktopAppShellProps) {
  return (
    <div className="picom-root">
      <div className="desktop-size-warning" role="status" aria-live="polite">
        <div className="desktop-warning-card">
          <span className="desktop-warning-icon" aria-hidden="true">
            <AppIcon name="maximize" size="xl" />
          </span>
          <h1>This app is optimized for desktop.</h1>
          <p>Resize the window to at least 1100px wide to use Picom's full desktop chat layout.</p>
        </div>
      </div>
      <section className="desktop-app-shell">{children}</section>
    </div>
  );
}