import type { ThemeMode } from "../services/settingsService";
import { AppIcon } from "./AppIcon";

type ThemeToggleProps = {
  theme: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
  onToggleTheme?: () => void;
  compact?: boolean;
  className?: string;
};

export function ThemeToggle({ theme, onThemeChange, onToggleTheme, compact = false, className = "" }: ThemeToggleProps) {
  const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
  const isDark = theme === "dark";

  const handleToggle = () => {
    if (onToggleTheme) {
      onToggleTheme();
      return;
    }

    onThemeChange?.(nextTheme);
  };

  return (
    <button
      type="button"
      className={`theme-toggle ${compact ? "compact" : ""} ${isDark ? "is-dark" : "is-light"} ${className}`.trim()}
      aria-label={`Switch to ${nextTheme} theme`}
      aria-pressed={isDark}
      title={`Switch to ${nextTheme} theme`}
      onClick={handleToggle}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <AppIcon name="sun" size="xs" />
        <span className="theme-toggle-knob" />
        <AppIcon name="moon" size="xs" />
      </span>
      {!compact ? <span className="theme-toggle-label">{isDark ? "Dark" : "Light"}</span> : null}
    </button>
  );
}