import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./session";
import { getAccountSupabase } from "./supabase";
import {
  applyAccountThemeToDocument,
  isAccountThemeMode,
  readStoredThemeMode,
  resolveAccountTheme,
  writeStoredThemeMode,
  type AccountThemeMode,
  type ResolvedAccountTheme,
} from "./themeMode";

type ThemeContextValue = {
  mode: AccountThemeMode;
  resolved: ResolvedAccountTheme;
  setMode: (mode: AccountThemeMode) => void;
  saving: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function initialMode(): AccountThemeMode {
  return readStoredThemeMode() ?? "system";
}

export function AccountThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mode, setModeState] = useState<AccountThemeMode>(initialMode);
  const [resolved, setResolved] = useState<ResolvedAccountTheme>(() => resolveAccountTheme(initialMode()));
  const [saving, setSaving] = useState(false);

  const apply = useCallback((next: AccountThemeMode) => {
    writeStoredThemeMode(next);
    setModeState(next);
    setResolved(applyAccountThemeToDocument(next));
  }, []);

  useEffect(() => {
    setResolved(applyAccountThemeToDocument(mode));
  }, [mode]);

  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setResolved(applyAccountThemeToDocument("system"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);

  useEffect(() => {
    if (!user) return;
    const supabase = getAccountSupabase();
    let cancelled = false;
    void supabase
      .from("user_settings")
      .select("theme_mode")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as { theme_mode?: string } | null;
        if (isAccountThemeMode(row?.theme_mode)) apply(row.theme_mode);
      });
    return () => {
      cancelled = true;
    };
  }, [user, apply]);

  const setMode = useCallback(
    (next: AccountThemeMode) => {
      apply(next);
      if (!user) return;
      setSaving(true);
      const supabase = getAccountSupabase();
      void supabase
        .from("user_settings")
        .upsert({
          user_id: user.id,
          theme_mode: next,
          updated_at: new Date().toISOString(),
        })
        .then(() => setSaving(false));
    },
    [apply, user],
  );

  const value = useMemo(
    () => ({ mode, resolved, setMode, saving }),
    [mode, resolved, setMode, saving],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAccountTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAccountTheme must be used within AccountThemeProvider");
  }
  return ctx;
}
