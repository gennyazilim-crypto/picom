import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { resolveTranslation } from "./format";
import { getFallbackNamespaceResource, getNamespaceResource } from "./registry";
import type { I18nNamespace, TFunction, TranslationLocale, TranslationParams } from "./types";

type I18nContextValue = Readonly<{ locale: TranslationLocale }>;

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: TranslationLocale;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(() => ({ locale }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18nContext(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within an I18nProvider (mount it near the App root).");
  }
  return ctx;
}

export function useCurrentLocale(): TranslationLocale {
  return useI18nContext().locale;
}

/**
 * Returns a `t(key, params)` function scoped to one namespace. Falls back to the English
 * resource when a key is missing/blank in the active locale (dev-only console.warn, never
 * thrown, never shown to the user) so a translation gap degrades gracefully instead of
 * breaking the screen.
 */
export function useTranslation(namespace: I18nNamespace): { t: TFunction; locale: TranslationLocale } {
  const { locale } = useI18nContext();

  const t = useCallback<TFunction>(
    (key: string, params?: TranslationParams) => {
      const resource = getNamespaceResource(locale, namespace);
      const resolved = resolveTranslation(resource, key, locale, params);
      if (resolved !== null) return resolved;

      const fallback = resolveTranslation(getFallbackNamespaceResource(namespace), key, "en", params);
      if (fallback !== null) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] Missing "${namespace}.${key}" for locale "${locale}"; using English fallback.`);
        }
        return fallback;
      }

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] Missing "${namespace}.${key}" for locale "${locale}" and no English fallback.`);
      }
      return key;
    },
    [locale, namespace],
  );

  return { t, locale };
}
