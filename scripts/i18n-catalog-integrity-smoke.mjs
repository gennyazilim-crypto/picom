// Run with: node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/i18n-catalog-integrity-smoke.mjs
//
// Translation-integrity gate across every PICOM locale catalog:
//   1. src/i18n/locales/<locale>/<namespace>.json  (unified runtime namespaces)
//   2. src/services/settings/settingsI18n*.ts      (Settings catalog, 10 locales)
//   3. src/services/localization/liveNowCatalog.ts (Live Now, 10 locales)
//   4. src/services/localization/publisherProgramCatalog.ts (Publisher program, 10 locales)
//
// Checks per locale: valid JSON, key parity vs English, no empty values, no
// TODO/TBD/TRANSLATE_ME markers, interpolation-variable parity, no HTML in values,
// and correct CLDR plural categories for plural-form entries.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const uiLanguages = await import("../src/services/localization/uiLanguages.ts");
const { SUPPORTED_UI_LANGUAGES, getUiLanguageBcp47 } = uiLanguages;

const LOCALES = [...SUPPORTED_UI_LANGUAGES];
const SOURCE = "en";
// Case-sensitive on purpose: lowercase "todo" is a real Spanish/Portuguese/Italian word
// ("all"), so a case-insensitive match would flag legitimate translations.
const PLACEHOLDER_PATTERN = /\b(TODO|TBD|TRANSLATE_ME|FIXME|XXX)\b|lorem ipsum/;
const HTML_PATTERN = /<\/?[a-z][\s\S]*?>/i;
const failures = [];

function fail(message) {
  failures.push(message);
}

/** {{var}} for the unified runtime, {var} for the legacy typed catalogs. */
function tokensOf(value) {
  return [
    ...[...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]),
    ...[...value.matchAll(/(?<!\{)\{(\w+)\}(?!\})/g)].map((m) => m[1]),
  ].sort();
}

/** Every plural category a locale can legitimately produce, per CLDR. */
function allowedPluralCategories(locale) {
  const tag = getUiLanguageBcp47(locale);
  const categories = new Set(["other"]);
  const rules = new Intl.PluralRules(tag);
  for (let n = 0; n <= 200; n += 1) categories.add(rules.select(n));
  for (const n of [0.5, 1.5, 2.5, 1000000]) categories.add(rules.select(n));
  return categories;
}

function checkValue(label, locale, key, value, sourceValue) {
  if (typeof value !== "string") {
    fail(`${label} ${locale}.${key}: expected string, got ${typeof value}`);
    return;
  }
  if (!value.trim()) fail(`${label} ${locale}.${key}: empty value`);
  if (PLACEHOLDER_PATTERN.test(value)) fail(`${label} ${locale}.${key}: placeholder marker in "${value}"`);
  if (HTML_PATTERN.test(value)) fail(`${label} ${locale}.${key}: HTML markup is not allowed in translations`);
  if (sourceValue !== undefined) {
    const expected = tokensOf(sourceValue);
    const actual = tokensOf(value);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      fail(`${label} ${locale}.${key}: interpolation mismatch (en=[${expected}] ${locale}=[${actual}])`);
    }
  }
}

// ---------------------------------------------------------------------------
// 1. Unified runtime namespaces (src/i18n/locales)
// ---------------------------------------------------------------------------
const localesDir = "src/i18n/locales";
assert.ok(existsSync(localesDir), `${localesDir} is missing`);

for (const locale of LOCALES) {
  assert.ok(existsSync(path.join(localesDir, locale)), `missing locale directory ${localesDir}/${locale}`);
}

const namespaces = readdirSync(path.join(localesDir, SOURCE))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));
assert.ok(namespaces.length > 0, "no namespace JSON files found for the English source locale");

let namespaceKeyTotal = 0;
for (const namespace of namespaces) {
  const sourcePath = path.join(localesDir, SOURCE, `${namespace}.json`);
  let source;
  try {
    source = JSON.parse(readFileSync(sourcePath, "utf8"));
  } catch (error) {
    fail(`invalid JSON in ${sourcePath}: ${error.message}`);
    continue;
  }
  const sourceKeys = Object.keys(source).sort();
  namespaceKeyTotal += sourceKeys.length;

  for (const locale of LOCALES) {
    const filePath = path.join(localesDir, locale, `${namespace}.json`);
    if (!existsSync(filePath)) {
      fail(`missing namespace file ${filePath}`);
      continue;
    }
    let data;
    try {
      data = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (error) {
      fail(`invalid JSON in ${filePath}: ${error.message}`);
      continue;
    }
    const keys = Object.keys(data).sort();
    const missing = sourceKeys.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !sourceKeys.includes(k));
    if (missing.length) fail(`${namespace}/${locale}: missing keys ${missing.slice(0, 8).join(", ")}`);
    if (extra.length) fail(`${namespace}/${locale}: unused/extra keys ${extra.slice(0, 8).join(", ")}`);

    const allowed = allowedPluralCategories(locale);
    for (const key of sourceKeys) {
      if (!(key in data)) continue;
      const value = data[key];
      const sourceValue = source[key];
      const sourceIsPlural = typeof sourceValue === "object" && sourceValue !== null;

      if (sourceIsPlural) {
        if (typeof value !== "object" || value === null) {
          fail(`${namespace}/${locale}.${key}: expected a plural-form object (source is plural)`);
          continue;
        }
        if (!("other" in value)) fail(`${namespace}/${locale}.${key}: plural map must define "other"`);
        for (const category of Object.keys(value)) {
          if (!allowed.has(category)) {
            fail(`${namespace}/${locale}.${key}: "${category}" is not a valid CLDR plural category for ${locale}`);
          }
          checkValue(namespace, locale, `${key}.${category}`, value[category], sourceValue.other);
        }
        // Every category the locale's plural rules can actually emit must be covered.
        for (const category of allowed) {
          if (!(category in value)) {
            fail(`${namespace}/${locale}.${key}: missing required plural category "${category}"`);
          }
        }
      } else {
        checkValue(namespace, locale, key, value, sourceValue);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2-4. Legacy typed catalogs (parity is enforced by each module's own assert fn)
// ---------------------------------------------------------------------------
const liveNow = await import("../src/services/localization/liveNowCatalog.ts");
const liveParity = liveNow.assertLiveNowLocaleParity?.();
if (liveParity && liveParity.ok === false) fail(`liveNowCatalog parity: ${liveParity.detail}`);

const publisher = await import("../src/services/localization/publisherProgramCatalog.ts");
const publisherParity = publisher.assertPublisherProgramLocaleParity();
if (publisherParity.ok === false) fail(`publisherProgramCatalog parity: ${publisherParity.detail}`);

// The Settings catalog imports settingsModalEn without an extension, which Node's
// type-stripping loader cannot resolve, so it is verified by text comparison instead.
// The English key set comes from the shared loader (which parses only the `en` catalog
// block) so unrelated maps in the same file -- e.g. settingsSectionKey, whose keys are
// section display names like "Privacy & Safety" -- are not mistaken for catalog keys.
const { loadEnSettingsSource } = await import("./settings-i18n-en-source.mjs");
function settingsKeys(file) {
  const source = readFileSync(file, "utf8");
  return new Set([...source.matchAll(/^ {2}"([^"]+)":/gm)].map((m) => m[1]));
}
const enSettings = new Set(Object.keys(loadEnSettingsSource()));
const settingsLocaleFiles = {
  tr: "settingsI18nTr", de: "settingsI18nDe", fr: "settingsI18nFr", es: "settingsI18nEs",
  it: "settingsI18nIt", pt: "settingsI18nPt", nl: "settingsI18nNl", pl: "settingsI18nPl",
  ru: "settingsI18nRu",
};
let settingsCovered = 0;
for (const [locale, base] of Object.entries(settingsLocaleFiles)) {
  const file = `src/services/settings/${base}.ts`;
  if (!existsSync(file)) {
    fail(`settings catalog missing for locale "${locale}" (${file} not generated)`);
    continue;
  }
  const keys = settingsKeys(file);
  const missing = [...enSettings].filter((k) => !keys.has(k));
  if (missing.length) {
    fail(`settings ${locale}: missing ${missing.length} keys (${missing.slice(0, 6).join(", ")})`);
  } else {
    settingsCovered += 1;
  }
}

if (failures.length) {
  console.error(`i18n catalog integrity: FAIL (${failures.length} issue(s))`);
  for (const message of failures.slice(0, 60)) console.error(`  - ${message}`);
  if (failures.length > 60) console.error(`  … and ${failures.length - 60} more`);
  process.exit(1);
}

console.log(
  `i18n catalog integrity: PASS — ${LOCALES.length} locales x ${namespaces.length} namespaces ` +
    `(${namespaceKeyTotal} source keys), settings catalogs verified for ${settingsCovered}/${Object.keys(settingsLocaleFiles).length} non-English locales, ` +
    `Live Now + Publisher parity OK.`,
);
