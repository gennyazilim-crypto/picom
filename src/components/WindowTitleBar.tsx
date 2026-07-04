import logoUrl from "../../assets/brand/picom-logo-concept.png";
import { windowService } from "../services/windowService";
import { AppIcon } from "./AppIcon";
import { ThemeToggle } from "./ThemeToggle";

type WindowTitleBarProps = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenSearch: () => void;
};

export function WindowTitleBar({ theme, onToggleTheme, onOpenSearch }: WindowTitleBarProps) {
  return (
    <header className="window-titlebar">
      <div className="window-brand">
        <img src={logoUrl} alt="Picom" />
        <strong>Picom</strong>
        <span>Desktop MVP</span>
      </div>

      <button className="titlebar-search" onClick={onOpenSearch} aria-label="Open command search">
        <AppIcon name="search" size="sm" />
        <span>Search Picom or press Ctrl K</span>
      </button>

      <div className="titlebar-actions">
        <span className="connection-pill">
          <span />Mock online
        </span>
        <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} compact />
        <button className="window-control" aria-label="Minimize window" onClick={() => void windowService.run("minimize")}>
          <AppIcon name="minimize" size="sm" />
        </button>
        <button className="window-control" aria-label="Maximize window" onClick={() => void windowService.run("maximize")}>
          <AppIcon name="maximize" size="sm" />
        </button>
        <button className="window-control danger" aria-label="Close window" onClick={() => void windowService.run("close")}>
          <AppIcon name="close" size="sm" />
        </button>
      </div>
    </header>
  );
}