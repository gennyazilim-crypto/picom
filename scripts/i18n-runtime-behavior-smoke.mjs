// Run with: node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/i18n-runtime-behavior-smoke.mjs
//
// Functional (not text-scan) verification of the i18n runtime: plural selection for the
// Slavic multi-category locales, interpolation, English fallback on a missing key, and
// locale-aware Intl date/number formatting.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { resolvePluralForm } = await import("../src/i18n/pluralRules.ts");
const { resolveTranslation, interpolate } = await import("../src/i18n/format.ts");
const { getUiLanguageBcp47, SUPPORTED_UI_LANGUAGES } = await import("../src/services/localization/uiLanguages.ts");

const load = (locale, ns) => JSON.parse(readFileSync(`src/i18n/locales/${locale}/${ns}.json`, "utf8"));

// --- Russian plural rules: 1 -> one, 2 -> few, 5 -> many, 21 -> one ---------------
const ruCommon = load("ru", "common");
const ruItems = ruCommon["count.items"];
assert.equal(resolvePluralForm(ruItems, 1, "ru"), "{{count}} элемент", "ru n=1 must select 'one'");
assert.equal(resolvePluralForm(ruItems, 2, "ru"), "{{count}} элемента", "ru n=2 must select 'few'");
assert.equal(resolvePluralForm(ruItems, 5, "ru"), "{{count}} элементов", "ru n=5 must select 'many'");
assert.equal(resolvePluralForm(ruItems, 21, "ru"), "{{count}} элемент", "ru n=21 must select 'one'");
assert.equal(resolvePluralForm(ruItems, 11, "ru"), "{{count}} элементов", "ru n=11 must select 'many'");

// --- Polish plural rules: 1 -> one, 2 -> few, 5 -> many, 22 -> few ----------------
const plCommon = load("pl", "common");
const plItems = plCommon["count.items"];
assert.equal(resolvePluralForm(plItems, 1, "pl"), "{{count}} element", "pl n=1 must select 'one'");
assert.equal(resolvePluralForm(plItems, 2, "pl"), "{{count}} elementy", "pl n=2 must select 'few'");
assert.equal(resolvePluralForm(plItems, 5, "pl"), "{{count}} elementów", "pl n=5 must select 'many'");
assert.equal(resolvePluralForm(plItems, 22, "pl"), "{{count}} elementy", "pl n=22 must select 'few'");
assert.equal(resolvePluralForm(plItems, 25, "pl"), "{{count}} elementów", "pl n=25 must select 'many'");

// --- End-to-end resolution with interpolation ------------------------------------
assert.equal(resolveTranslation(ruCommon, "count.items", "ru", { count: 5 }), "5 элементов");
assert.equal(resolveTranslation(plCommon, "count.items", "pl", { count: 2 }), "2 elementy");
assert.equal(resolveTranslation(load("en", "common"), "count.items", "en", { count: 1 }), "1 item");
assert.equal(resolveTranslation(load("tr", "feed"), "media.open", "tr", { name: "kedi.png" }), "kedi.png dosyasını aç");

// Missing key resolves to null (caller falls back to English) rather than throwing.
assert.equal(resolveTranslation(ruCommon, "does.not.exist", "ru"), null);
// Unresolved parameters render as empty string, never "undefined".
assert.equal(interpolate("Hello {{name}}!", {}), "Hello !");
assert.ok(!interpolate("Hello {{name}}!", {}).includes("undefined"));

// --- Locale-aware Intl formatting differs per locale -----------------------------
const sample = new Date("2026-03-09T14:05:00Z");
const numbers = new Map();
const dates = new Map();
for (const locale of SUPPORTED_UI_LANGUAGES) {
  const tag = getUiLanguageBcp47(locale);
  numbers.set(locale, new Intl.NumberFormat(tag).format(1234567.89));
  dates.set(locale, new Intl.DateTimeFormat(tag, { dateStyle: "long", timeZone: "UTC" }).format(sample));
}
// German uses "." grouping / "," decimal; English uses the inverse — proves formatting is
// actually locale-driven rather than a fixed format.
assert.notEqual(numbers.get("de"), numbers.get("en"), "de and en number formats must differ");
assert.equal(numbers.get("de"), "1.234.567,89", "unexpected German number format");
assert.equal(numbers.get("en"), "1,234,567.89", "unexpected English number format");
assert.notEqual(dates.get("ru"), dates.get("en"), "ru and en long dates must differ");
assert.notEqual(dates.get("tr"), dates.get("en"), "tr and en long dates must differ");

// Relative time is locale-aware too.
const rtfEn = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" }).format(-3, "hour");
const rtfPl = new Intl.RelativeTimeFormat("pl-PL", { numeric: "auto" }).format(-3, "hour");
assert.notEqual(rtfEn, rtfPl, "relative-time output must be locale-aware");

console.log(
  `i18n runtime behavior smoke: PASS — ru/pl plural categories, interpolation, missing-key fallback, ` +
    `and locale-aware date/number/relative formatting verified across ${SUPPORTED_UI_LANGUAGES.length} locales.`,
);
