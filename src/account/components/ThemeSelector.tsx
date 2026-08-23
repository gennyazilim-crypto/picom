import { IconCheck, IconMonitor, IconMoon, IconSun } from "./AccountIcons";
import { useAccountTheme } from "../lib/theme";
import type { AccountThemeMode } from "../lib/themeMode";
import { t } from "../i18n/messages";

const OPTIONS: Array<{
  mode: AccountThemeMode;
  labelKey: "preferences.theme.light" | "preferences.theme.dark" | "preferences.theme.system";
  Icon: typeof IconSun;
  preview: "light" | "dark" | "system";
}> = [
  { mode: "light", labelKey: "preferences.theme.light", Icon: IconSun, preview: "light" },
  { mode: "dark", labelKey: "preferences.theme.dark", Icon: IconMoon, preview: "dark" },
  { mode: "system", labelKey: "preferences.theme.system", Icon: IconMonitor, preview: "system" },
];

type ThemeSelectorProps = {
  variant?: "cards" | "menu";
  onSelect?: (mode: AccountThemeMode) => void;
};

export function ThemeSelector({ variant = "cards", onSelect }: ThemeSelectorProps) {
  const { mode, setMode } = useAccountTheme();

  const choose = (next: AccountThemeMode) => {
    setMode(next);
    onSelect?.(next);
  };

  if (variant === "menu") {
    return (
      <div className="ac-theme-menu" role="radiogroup" aria-label={t("preferences.theme")}>
        {OPTIONS.map(({ mode: option, labelKey, Icon }) => {
          const selected = mode === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`ac-theme-menu__item${selected ? " is-selected" : ""}`}
              onClick={() => choose(option)}
            >
              <Icon />
              <span>{t(labelKey)}</span>
              {selected ? <IconCheck className="ac-theme-menu__check" /> : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="ac-theme-cards" role="radiogroup" aria-label={t("preferences.theme")}>
      {OPTIONS.map(({ mode: option, labelKey, Icon, preview }) => {
        const selected = mode === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`ac-theme-card${selected ? " is-selected" : ""}`}
            onClick={() => choose(option)}
          >
            <span className={`ac-theme-card__preview ac-theme-card__preview--${preview}`} aria-hidden="true" />
            <span className="ac-theme-card__meta">
              <Icon />
              <span>{t(labelKey)}</span>
              {selected ? <IconCheck className="ac-theme-card__check" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
