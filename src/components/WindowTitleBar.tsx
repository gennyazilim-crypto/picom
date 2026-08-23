import { useEffect, useState } from "react";
import { brandLogoUrl } from "../config/brandAssets";
import { appConfig } from "../config/appConfig";
import "./WindowTitleBar.css";
import { windowService } from "../services/windowService";
import { AppIcon } from "./AppIcon";
import { ThemeToggle } from "./ThemeToggle";
import { mvpUiIconMap } from "./iconRegistry";

function getBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
type WindowTitleBarProps = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  onOpenNotifications?: () => void;
  notificationUnreadCount?: number;
};

const titleBarIcons = mvpUiIconMap.windowTitleBar;

export function WindowTitleBar({ theme, onToggleTheme, onOpenSearch, onOpenNotifications, notificationUnreadCount = 0 }: WindowTitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [pendingAction, setPendingAction] = useState<"minimize" | "maximize" | "close" | null>(null);
  const [controlStatus, setControlStatus] = useState("");
  const [isOnline, setIsOnline] = useState(getBrowserOnline);
  const [companionBusy, setCompanionBusy] = useState(false);
  const companionAvailable = Boolean(appConfig.features.companionMode && window.picomDesktop?.companion?.enterMode);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(getBrowserOnline());
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

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

  const runWindowAction = async (action: "minimize" | "maximize" | "close") => {
    if (pendingAction) return;
    setPendingAction(action);
    setControlStatus("");
    const result = await windowService.run(action);

    if (!result.ok) {
      setControlStatus("Window controls are unavailable. Restart Picom if the problem continues.");
      setPendingAction(null);
      return;
    }

    if (action === "maximize") {
      setIsMaximized(result.maximized);
      setControlStatus(result.maximized ? "Window maximized." : "Window restored.");
    }

    setPendingAction(null);
  };

  const enterCompanionMode = async () => {
    if (!companionAvailable || companionBusy) return;
    setCompanionBusy(true);
    setControlStatus("");
    try {
      await window.picomDesktop?.companion?.enterMode();
      setControlStatus("Switched to Companion mode.");
    } catch {
      setControlStatus("Companion mode could not be opened.");
    } finally {
      setCompanionBusy(false);
    }
  };

  return (
    <header className={`window-titlebar ${isMaximized ? "is-maximized" : ""}`} data-window-state={isMaximized ? "maximized" : "normal"}>
      <div className="window-brand">
        <img className="picom-brand-logo" src={brandLogoUrl} alt="Picom" />
        <strong>Picom</strong>
      </div>

      <button type="button" className="titlebar-search" onClick={onOpenSearch} aria-label="Open command search">
        <AppIcon name={titleBarIcons.search} size="sm" />
        <span>Search Picom or press Ctrl K</span>
      </button>

      <div className="titlebar-actions">
        {companionAvailable ? (
          <button
            type="button"
            className="window-titlebar-companion-button"
            aria-label="Switch to Picom Companion mode"
            title="Switch to Picom Companion mode (Ctrl+Shift+C)"
            disabled={companionBusy}
            onClick={() => void enterCompanionMode()}
          >
            <span className="window-titlebar-companion-glyph" aria-hidden="true" />
            <span>Companion</span>
          </button>
        ) : null}
        <span
          className={`titlebar-network-status${isOnline ? " is-online" : " is-offline"}`}
          role="status"
          aria-label={isOnline ? "Internet connection available" : "No internet connection"}
          title={isOnline ? "Online" : "Offline"}
        />
        {onOpenNotifications ? (
          <button type="button" className="window-control titlebar-notification-button" aria-label="Open notifications" onClick={onOpenNotifications}>
            <AppIcon name="bell" size="sm" />
            {notificationUnreadCount ? <span>{notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}</span> : null}
          </button>
        ) : null}
        <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} compact />
        <button type="button" className="window-control" aria-label="Minimize window" title="Minimize" disabled={pendingAction !== null} onClick={() => void runWindowAction("minimize")}>
          <AppIcon name={titleBarIcons.minimize} size="sm" />
        </button>
        <button type="button" className={`window-control ${isMaximized ? "is-restore" : ""}`} aria-label={isMaximized ? "Restore window" : "Maximize window"} aria-pressed={isMaximized} title={isMaximized ? "Restore" : "Maximize"} disabled={pendingAction !== null} onClick={() => void runWindowAction("maximize")}>
          <AppIcon name={titleBarIcons.maximize} size="sm" />
        </button>
        <button type="button" className="window-control danger" aria-label="Close window" title="Close" disabled={pendingAction !== null} onClick={() => void runWindowAction("close")}>
          <AppIcon name={titleBarIcons.close} size="sm" />
        </button>
        <span className="titlebar-control-status" role="status" aria-live="polite">{controlStatus}</span>
      </div>
    </header>
  );
}
