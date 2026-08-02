/** Account Center theme: light | dark | system (resolved via prefers-color-scheme). */
export type AccountThemeMode = "light" | "dark" | "system";
export type ResolvedAccountTheme = "light" | "dark";

export const ACCOUNT_THEME_STORAGE_KEY = "picom.account.theme_mode";

export function isAccountThemeMode(value: unknown): value is AccountThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function getSystemTheme(): ResolvedAccountTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function resolveAccountTheme(mode: AccountThemeMode): ResolvedAccountTheme {
  return mode === "system" ? getSystemTheme() : mode;
}

export function readStoredThemeMode(): AccountThemeMode | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_THEME_STORAGE_KEY);
    return isAccountThemeMode(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredThemeMode(mode: AccountThemeMode): void {
  try {
    localStorage.setItem(ACCOUNT_THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore quota / private mode.
  }
}

export function applyAccountThemeToDocument(mode: AccountThemeMode): ResolvedAccountTheme {
  const resolved = resolveAccountTheme(mode);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themeMode = mode;
  root.style.colorScheme = resolved;
  return resolved;
}
