import { DEFAULT_UI_LANGUAGE, SUPPORTED_UI_LANGUAGES } from "../services/localization/uiLanguages";
import { I18N_NAMESPACES } from "./types";
import type { I18nNamespace, NamespaceResource, TranslationLocale } from "./types";

/**
 * Eager-loads every locale/namespace JSON resource at build time (desktop app: all
 * resources ship in the bundle, no runtime network fetch or lazy chunk loading needed).
 * Vite resolves this glob statically; each matched file's default export is the parsed
 * JSON object.
 */
const modules = import.meta.glob("./locales/*/*.json", { eager: true }) as Record<
  string,
  { default: NamespaceResource }
>;

type Registry = Record<TranslationLocale, Partial<Record<I18nNamespace, NamespaceResource>>>;

function buildRegistry(): Registry {
  const registry = Object.fromEntries(
    SUPPORTED_UI_LANGUAGES.map((locale) => [locale, {}]),
  ) as Registry;

  for (const [path, mod] of Object.entries(modules)) {
    const match = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
    if (!match) continue;
    const [, locale, namespace] = match;
    if (!(SUPPORTED_UI_LANGUAGES as readonly string[]).includes(locale)) continue;
    if (!(I18N_NAMESPACES as readonly string[]).includes(namespace)) continue;
    registry[locale as TranslationLocale][namespace as I18nNamespace] = mod.default;
  }

  return registry;
}

const REGISTRY = buildRegistry();

export function getNamespaceResource(
  locale: TranslationLocale,
  namespace: I18nNamespace,
): NamespaceResource | undefined {
  return REGISTRY[locale]?.[namespace];
}

export function getFallbackNamespaceResource(namespace: I18nNamespace): NamespaceResource | undefined {
  return REGISTRY[DEFAULT_UI_LANGUAGE]?.[namespace];
}
