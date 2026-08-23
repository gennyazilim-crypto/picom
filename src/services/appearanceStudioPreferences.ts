/** Canonical device-level options used by the Appearance & Accessibility Studio. */
export const TEXT_SIZE_OPTIONS = ["default", "large", "extra-large"] as const;
export type TextSize = (typeof TEXT_SIZE_OPTIONS)[number];

export const INTERFACE_SCALE_FACTORS = [0.9, 1, 1.1, 1.25] as const;
export type InterfaceScale = (typeof INTERFACE_SCALE_FACTORS)[number];

export type AppearanceStudioAccessibilitySettings = Readonly<{
  textSize: TextSize;
  interfaceScale: InterfaceScale;
  highContrast: boolean;
  reducedMotion: boolean;
  focusRingStrong: boolean;
}>;

type LegacyAccessibilityInput = Partial<AppearanceStudioAccessibilitySettings> & Readonly<{ largerText?: unknown }>;

const appearanceStudioDefaults = Object.freeze({
  appearance: Object.freeze({ themeMode: "system" as const, density: "comfortable" as const }),
  accessibility: Object.freeze({
    textSize: "default" as TextSize,
    interfaceScale: 1 as InterfaceScale,
    highContrast: false,
    reducedMotion: false,
    focusRingStrong: false,
  }),
});

export function isTextSize(value: unknown): value is TextSize {
  return typeof value === "string" && (TEXT_SIZE_OPTIONS as readonly string[]).includes(value);
}

export function isInterfaceScale(value: unknown): value is InterfaceScale {
  return typeof value === "number" && Number.isFinite(value) && (INTERFACE_SCALE_FACTORS as readonly number[]).includes(value);
}

/**
 * Normalizes the v13 boolean `largerText` into the semantic text-size model.
 * A persisted semantic value takes priority once it exists.
 */
export function normalizeAccessibilitySettings(input: LegacyAccessibilityInput | undefined): AppearanceStudioAccessibilitySettings {
  const textSize = isTextSize(input?.textSize)
    ? input.textSize
    : input?.largerText === true ? "large" : "default";
  return {
    textSize,
    interfaceScale: isInterfaceScale(input?.interfaceScale) ? input.interfaceScale : appearanceStudioDefaults.accessibility.interfaceScale,
    highContrast: input?.highContrast === true,
    reducedMotion: input?.reducedMotion === true,
    focusRingStrong: input?.focusRingStrong === true,
  };
}

export function getAppearanceStudioDefaults() {
  return {
    appearance: { ...appearanceStudioDefaults.appearance },
    accessibility: { ...appearanceStudioDefaults.accessibility },
  };
}

/** Pure mapping retained for DOM and preview runtime tests without a browser. */
export function getAppearanceStudioRootAttributes(
  resolvedTheme: "light" | "dark",
  themePreference: "system" | "light" | "dark",
  density: "comfortable" | "compact",
  accessibility: AppearanceStudioAccessibilitySettings,
) {
  return {
    theme: resolvedTheme,
    themePreference,
    density,
    highContrast: accessibility.highContrast ? "true" : "false",
    reducedMotion: accessibility.reducedMotion ? "true" : "false",
    textSize: accessibility.textSize,
    interfaceScale: String(accessibility.interfaceScale),
    focusRingStrong: accessibility.focusRingStrong ? "true" : "false",
  } as const;
}
