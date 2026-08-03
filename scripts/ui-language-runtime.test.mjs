/**
 * Canonical 10-locale UiLanguage registry + RTL + Live Now catalog coverage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const {
  SUPPORTED_UI_LANGUAGES,
  normalizeUiLanguage,
  isRtlUiLanguage,
  getUiLanguageMetadata,
  DEFAULT_UI_LANGUAGE,
} = await import(pathToFileURL(join(root, "src/services/localization/uiLanguages.ts")).href);

const { LIVE_NOW_LOCALES, translateLiveNow } = await import(
  pathToFileURL(join(root, "src/services/localization/liveNowCatalog.ts")).href
);

const CANONICAL = ["en", "tr", "de", "fr", "es", "it", "pt", "ru", "ar", "ja"];

test("canonical UiLanguage registry is exactly 10 locales", () => {
  assert.deepEqual([...SUPPORTED_UI_LANGUAGES], CANONICAL);
  assert.equal(DEFAULT_UI_LANGUAGE, "en");
});

test("normalizeUiLanguage preserves en/tr and maps unknown to en", () => {
  assert.equal(normalizeUiLanguage("en"), "en");
  assert.equal(normalizeUiLanguage("tr"), "tr");
  assert.equal(normalizeUiLanguage("ar"), "ar");
  assert.equal(normalizeUiLanguage("xx"), "en");
  assert.equal(normalizeUiLanguage(""), "en");
  assert.equal(normalizeUiLanguage(null), "en");
  assert.equal(normalizeUiLanguage("EN"), "en");
});

test("Arabic is RTL; other canonical locales are LTR", () => {
  for (const locale of SUPPORTED_UI_LANGUAGES) {
    const meta = getUiLanguageMetadata(locale);
    assert.equal(meta.code, locale);
    assert.ok(meta.nativeLabel.length > 0);
    assert.ok(meta.bcp47.length > 0);
    assert.equal(isRtlUiLanguage(locale), locale === "ar");
    assert.equal(meta.direction, locale === "ar" ? "rtl" : "ltr");
  }
});

test("Live Now catalogs cover all 10 locales with identical key sets and no empty strings", () => {
  const enKeys = Object.keys(LIVE_NOW_LOCALES.en).sort();
  assert.ok(enKeys.length > 40);
  for (const locale of CANONICAL) {
    const catalog = LIVE_NOW_LOCALES[locale];
    assert.ok(catalog, `missing catalog ${locale}`);
    assert.deepEqual(Object.keys(catalog).sort(), enKeys);
    for (const [key, value] of Object.entries(catalog)) {
      assert.equal(typeof value, "string");
      assert.ok(value.trim().length > 0, `${locale}.${key} empty`);
    }
    assert.doesNotThrow(() => translateLiveNow("live.now.title", locale));
  }
  assert.equal(translateLiveNow("live.now.title", "not-a-locale"), LIVE_NOW_LOCALES.en["live.now.title"]);
});

test("settingsService sanitizes language via normalizeUiLanguage (source contract)", () => {
  const src = readFileSync(join(root, "src/services/settingsService.ts"), "utf8");
  assert.match(src, /normalizeUiLanguage/);
  assert.match(src, /from ["'].*uiLanguages/);
  assert.doesNotMatch(src, /language === ["']tr["'] \? ["']tr["'] : ["']en["']/);
});

test("appearanceService applies document lang and dir for RTL", () => {
  const src = readFileSync(join(root, "src/services/appearanceService.ts"), "utf8");
  assert.match(src, /root\.lang\s*=\s*meta\.bcp47/);
  assert.match(src, /root\.dir\s*=\s*meta\.direction/);
  assert.match(src, /getUiLanguageMetadata/);
});
