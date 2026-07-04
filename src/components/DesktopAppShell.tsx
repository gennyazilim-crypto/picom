import { useEffect, useState, type ReactNode } from "react";
import { windowService } from "../services/windowService";
import { AppIcon } from "./AppIcon";

type DesktopAppShellProps = {
  children: ReactNode;
};

export function DesktopAppShell({ children }: DesktopAppShellProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let mounted = true;

    void windowService.isMaximized().then((value) => {
      if (mounted) {
        setIsMaximized(value);
      }
    });

    const unsubscribe = windowService.onMaximizeStateChanged(setIsMaximized);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className={`picom-root${isMaximized ? " is-maximized" : ""}`} data-window-state={isMaximized ? "maximized" : "normal"}>
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