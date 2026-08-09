import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "src/services/localization/havoocSupportCatalog.ts");
const source = readFileSync(catalogPath, "utf8");

test("havooc support catalog declares 10 locales and parity helper", () => {
  for (const locale of ["en", "tr", "de", "fr", "es", "it", "pt", "ru", "ar", "ja"]) {
    assert.match(source, new RegExp(`\\b${locale}:`));
  }
  assert.match(source, /assertHavoocSupportLocaleParity/);
  assert.match(source, /SUPPORTED_UI_LANGUAGES/);
  assert.match(source, /"notes\.title"/);
  assert.match(source, /"notes\.sign"/);
  assert.match(source, /"notes\.empty"/);
  assert.match(source, /Destek Notları/);
});

test("havooc support translator interpolates placeholders in source contract", () => {
  assert.match(source, /template\.replace/);
  assert.match(source, /normalizeUiLanguage/);
});
