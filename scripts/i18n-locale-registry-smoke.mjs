// Run with: node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/i18n-locale-registry-smoke.mjs
// (the classic `typescript` package's transpileModule API is unavailable under the
// TypeScript 7 native-compiler package installed in this repo, so this test imports
// the module directly and relies on Node's built-in TS type-stripping instead.)
import assert from "node:assert/strict";

const mod = await import("../src/services/localization/uiLanguages.ts");
const {
  SUPPORTED_UI_LANGUAGES,
  DEFAULT_UI_LANGUAGE,
  normalizeUiLanguage,
  resolveSystemUiLanguage,
  getUiLanguageBcp47,
  listUiLanguageMetadata,
  isUiLanguage,
} = mod;

const EXPECTED_LANGUAGES = ["en", "tr", "de", "fr", "es", "it", "pt", "nl", "pl", "ru"];
assert.deepEqual([...SUPPORTED_UI_LANGUAGES].sort(), [...EXPECTED_LANGUAGES].sort(), "registry must contain exactly the 10 required languages");
assert.equal(SUPPORTED_UI_LANGUAGES.length, 10, "registry must have exactly 10 languages");
for (const stale of ["ar", "ja"]) {
  assert.ok(!SUPPORTED_UI_LANGUAGES.includes(stale), `stale language "${stale}" must be removed from the registry`);
}
assert.equal(DEFAULT_UI_LANGUAGE, "en", "English must remain the fallback/default language");

const EXPECTED_BCP47 = {
  en: "en-US", tr: "tr-TR", de: "de-DE", fr: "fr-FR", es: "es-ES",
  it: "it-IT", pt: "pt-BR", nl: "nl-NL", pl: "pl-PL", ru: "ru-RU",
};
for (const [code, expectedTag] of Object.entries(EXPECTED_BCP47)) {
  assert.equal(getUiLanguageBcp47(code), expectedTag, `BCP-47 tag mismatch for ${code}`);
}

const metadata = listUiLanguageMetadata();
assert.equal(metadata.length, 10, "listUiLanguageMetadata must return all 10 entries");
for (const entry of metadata) {
  assert.ok(entry.nativeLabel && entry.nativeLabel.trim(), `missing nativeLabel for ${entry.code}`);
  assert.ok(entry.englishLabel && entry.englishLabel.trim(), `missing englishLabel for ${entry.code}`);
  assert.equal(entry.direction, "ltr", `unexpected non-LTR direction for ${entry.code}`);
}

// Regional-variant and unsupported-locale normalization (mandatory correction #5).
const NORMALIZATION_CASES = [
  ["de-AT", "de"],
  ["de-CH", "de"],
  ["en-GB", "en"],
  ["pt-PT", "pt"],
  ["nl-BE", "nl"],
  ["tr-CY", "tr"],
  ["zz-ZZ", "en"],
  ["klingon", "en"],
  [undefined, "en"],
  [null, "en"],
  ["", "en"],
  ["EN-us", "en"],
  ["Tr_TR", "tr"],
];
for (const [input, expected] of NORMALIZATION_CASES) {
  assert.equal(normalizeUiLanguage(input), expected, `normalizeUiLanguage(${JSON.stringify(input)}) should resolve to "${expected}"`);
  assert.equal(resolveSystemUiLanguage(input), expected, `resolveSystemUiLanguage(${JSON.stringify(input)}) should resolve to "${expected}"`);
}

for (const code of EXPECTED_LANGUAGES) {
  assert.ok(isUiLanguage(code), `isUiLanguage should accept "${code}"`);
}
assert.ok(!isUiLanguage("ar"), "isUiLanguage must reject removed language codes");
assert.ok(!isUiLanguage("ja"), "isUiLanguage must reject removed language codes");

console.log("i18n locale registry + BCP-47 + normalization smoke: PASS");
