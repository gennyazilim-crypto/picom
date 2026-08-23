import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "../../i18n";
import {
  INTERFACE_SCALE_FACTORS,
  TEXT_SIZE_OPTIONS,
} from "../../services/appearanceStudioPreferences";
import type {
  AccessibilitySettings,
  AppearanceSettings,
  InterfaceScale,
  TextSize,
  ThemePreference,
} from "../../services/settingsService";

type AppearanceStudioProps = {
  appearanceSettings: AppearanceSettings;
  accessibilitySettings: AccessibilitySettings;
  onThemeChange: (theme: ThemePreference) => void;
  onAppearanceChange: (partial: Partial<AppearanceSettings>) => void;
  onAccessibilityChange: (partial: Partial<AccessibilitySettings>) => void;
  onInterfaceScaleChange: (scale: InterfaceScale) => Promise<boolean>;
  onResetAppearance: () => Promise<boolean>;
};

const themeOptions: readonly ThemePreference[] = ["system", "light", "dark"];

/** A pure, local preview; it never mounts product data, realtime, or media services. */
export function AppearanceStudio({
  appearanceSettings,
  accessibilitySettings,
  onThemeChange,
  onAppearanceChange,
  onAccessibilityChange,
  onInterfaceScaleChange,
  onResetAppearance,
}: AppearanceStudioProps) {
  const { t } = useTranslation("firstLaunch");
  const [status, setStatus] = useState<string | null>(null);
  const canAdjustInterfaceScale = typeof window !== "undefined" && Boolean(window.picomDesktop?.appearance?.setInterfaceScale);

  const changeThemeFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, currentTheme: ThemePreference) => {
    if (!(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const).includes(event.key as "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown")) return;
    event.preventDefault();
    const currentIndex = themeOptions.indexOf(currentTheme);
    const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const nextTheme = themeOptions[(currentIndex + direction + themeOptions.length) % themeOptions.length];
    onThemeChange(nextTheme);
    const group = event.currentTarget.closest("[role=radiogroup]");
    group?.querySelector<HTMLButtonElement>(`[data-theme-option='${nextTheme}']`)?.focus();
  };

  const changeScale = async (scale: InterfaceScale) => {
    setStatus(null);
    if (!(await onInterfaceScaleChange(scale))) setStatus(t("appearance.scaleApplyFailed"));
  };

  const resetAppearance = async () => {
    setStatus(null);
    if (!(await onResetAppearance())) setStatus(t("appearance.scaleApplyFailed"));
  };

  return (
    <div className="first-launch-appearance-studio">
      <div className="first-launch-appearance-controls">
        <fieldset className="first-launch-studio-section">
          <legend>{t("appearance.themeLegend")}</legend>
          <div className="first-launch-studio-theme-grid" role="radiogroup" aria-label={t("appearance.themeGroupLabel")}>
            {themeOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                data-theme-option={option}
                aria-checked={appearanceSettings.themeMode === option}
                className={appearanceSettings.themeMode === option ? "is-selected" : ""}
                onClick={() => onThemeChange(option)}
                onKeyDown={(event) => changeThemeFromKeyboard(event, option)}
              >
                <ThemeCardPreview option={option} />
                <span><strong>{t(`theme.${option}`)}</strong><small>{t(option === "system" ? "appearance.followSystem" : `theme.${option}Hint`)}</small></span>
                {appearanceSettings.themeMode === option ? <i aria-hidden="true">✓</i> : null}
              </button>
            ))}
          </div>
        </fieldset>

        <ChoiceGroup
          label={t("appearance.densityLegend")}
          value={appearanceSettings.density}
          options={[
            { value: "comfortable", label: t("appearance.comfortable"), hint: t("appearance.comfortableHint") },
            { value: "compact", label: t("appearance.compact"), hint: t("appearance.compactHint") },
          ]}
          onChange={(density) => onAppearanceChange({ density: density as AppearanceSettings["density"] })}
        />

        <ChoiceGroup
          label={t("appearance.textSizeLegend")}
          value={accessibilitySettings.textSize}
          options={TEXT_SIZE_OPTIONS.map((textSize) => ({
            value: textSize,
            label: t(`appearance.textSize.${textSize}`),
            hint: t(`appearance.textSize.${textSize}Hint`),
          }))}
          onChange={(textSize) => onAccessibilityChange({ textSize: textSize as TextSize })}
        />

        {canAdjustInterfaceScale ? (
          <ChoiceGroup
            label={t("appearance.interfaceScaleLegend")}
            value={String(accessibilitySettings.interfaceScale)}
            options={INTERFACE_SCALE_FACTORS.map((scale) => ({ value: String(scale), label: t(`appearance.interfaceScale.${Math.round(scale * 100)}`), hint: t(`appearance.interfaceScale.${Math.round(scale * 100)}Hint`) }))}
            onChange={(scale) => void changeScale(Number(scale) as InterfaceScale)}
          />
        ) : null}

        <fieldset className="first-launch-studio-section first-launch-studio-section--toggles">
          <legend>{t("appearance.accessibilityLegend")}</legend>
          <StudioToggle label={t("appearance.reduceMotion")} hint={t("appearance.reduceMotionHint")} checked={accessibilitySettings.reducedMotion} onChange={(reducedMotion) => onAccessibilityChange({ reducedMotion })} />
          <StudioToggle label={t("appearance.enhancedContrast")} hint={t("appearance.enhancedContrastHint")} checked={accessibilitySettings.highContrast} onChange={(highContrast) => onAccessibilityChange({ highContrast })} />
          <StudioToggle label={t("appearance.strongFocus")} hint={t("appearance.strongFocusHint")} checked={accessibilitySettings.focusRingStrong} onChange={(focusRingStrong) => onAccessibilityChange({ focusRingStrong })} />
        </fieldset>

        <button type="button" className="first-launch-reset-appearance" onClick={() => void resetAppearance()}>{t("appearance.reset")}</button>
        {status ? <p className="first-launch-studio-status" role="status">{status}</p> : null}
      </div>

      <aside className="first-launch-appearance-preview-wrap" aria-label={t("appearance.livePreview")}>
        <span className="first-launch-preview-label">{t("appearance.livePreview")}</span>
        <AppearanceStudioPreview accessibilitySettings={accessibilitySettings} density={appearanceSettings.density} t={t} />
      </aside>
    </div>
  );
}

function ThemeCardPreview({ option }: { option: ThemePreference }) {
  return <span className={`first-launch-theme-card-preview is-${option}`} aria-hidden="true"><span /><span><i /><i /><i /></span></span>;
}

function ChoiceGroup({ label, value, options, onChange }: { label: string; value: string; options: readonly { value: string; label: string; hint: string }[]; onChange: (value: string) => void }) {
  return <fieldset className="first-launch-studio-section">
    <legend>{label}</legend>
    <div className="first-launch-choice-grid" role="radiogroup" aria-label={label}>
      {options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? "is-selected" : ""} onClick={() => onChange(option.value)}><span><strong>{option.label}</strong><small>{option.hint}</small></span>{value === option.value ? <i aria-hidden="true">✓</i> : null}</button>)}
    </div>
  </fieldset>;
}

function StudioToggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="first-launch-studio-toggle"><span><strong>{label}</strong><small>{hint}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function AppearanceStudioPreview({ accessibilitySettings, density, t }: { accessibilitySettings: AccessibilitySettings; density: AppearanceSettings["density"]; t: (key: string) => string }) {
  return <div className="first-launch-appearance-preview" data-density={density} data-text-size={accessibilitySettings.textSize} data-interface-scale={accessibilitySettings.interfaceScale} data-high-contrast={accessibilitySettings.highContrast} data-focus-ring-strong={accessibilitySettings.focusRingStrong}>
    <aside><b>P</b><span>{t("appearance.preview.nav")}</span><span>{t("appearance.preview.direct")}</span></aside>
    <section><header><span className="first-launch-preview-avatar" aria-hidden="true" /><div><strong>{t("appearance.preview.channel")}</strong><small>{t("appearance.preview.subtitle")}</small></div></header><div className="first-launch-preview-message"><span className="first-launch-preview-avatar" aria-hidden="true" /><p>{t("appearance.preview.message")}</p></div><button type="button">{t("appearance.preview.action")}</button></section>
  </div>;
}
