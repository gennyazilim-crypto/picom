export { I18nProvider, useCurrentLocale, useTranslation } from "./context";
export { interpolate, resolveTranslation } from "./format";
export { isPluralForms, resolvePluralForm } from "./pluralRules";
export { getFallbackNamespaceResource, getNamespaceResource } from "./registry";
export { I18N_NAMESPACES } from "./types";
export type {
  I18nNamespace,
  NamespaceResource,
  PluralForms,
  TFunction,
  TranslationLocale,
  TranslationParams,
  TranslationValue,
} from "./types";
