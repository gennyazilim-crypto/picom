import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LIVE_NOW_I18N_KEYS,
  LIVE_NOW_LOCALE_CODES,
  LIVE_NOW_LOCALES,
  translateLiveNow,
} from "../src/services/localization/liveNowCatalog.ts";

test("Live Now i18n all locale key parity", () => {
  const enKeys = Object.keys(LIVE_NOW_LOCALES.en).sort();
  assert.deepEqual(enKeys, [...LIVE_NOW_I18N_KEYS].sort());
  assert.deepEqual([...LIVE_NOW_LOCALE_CODES].sort(), [
    "ar",
    "de",
    "en",
    "es",
    "fr",
    "it",
    "ja",
    "pt",
    "ru",
    "tr",
  ]);

  for (const locale of LIVE_NOW_LOCALE_CODES) {
    const keys = Object.keys(LIVE_NOW_LOCALES[locale]).sort();
    assert.deepEqual(keys, enKeys, `${locale} key mismatch`);
    for (const key of LIVE_NOW_I18N_KEYS) {
      assert.ok(
        LIVE_NOW_LOCALES[locale][key].trim().length > 0,
        `${locale} missing or empty ${key}`,
      );
    }
  }
});

test("translateLiveNow normalizes unknown locale to en", () => {
  assert.equal(translateLiveNow("live.now.title", "xx"), LIVE_NOW_LOCALES.en["live.now.title"]);
  assert.equal(translateLiveNow("live.now.title", "EN"), LIVE_NOW_LOCALES.en["live.now.title"]);
});

test("Live Now Turkish empty-state and CTA copy match product wording", () => {
  assert.equal(translateLiveNow("live.now.empty.title", "tr"), "Şu anda canlı yayın yok");
  assert.match(
    translateLiveNow("live.now.empty.body", "tr"),
    /Onaylı Creator ve Publisher/,
  );
  assert.equal(translateLiveNow("live.now.empty.ctaDiscover", "tr"), "Yayıncıları keşfet");
  assert.equal(translateLiveNow("live.now.cta.apply", "tr"), "Creator/Publisher Başvurusu");
  assert.equal(translateLiveNow("live.now.cta.dashboard", "tr"), "Yayıncı paneli");
  assert.equal(translateLiveNow("live.now.cta.goLive", "tr"), "Yayın başlat");
  assert.equal(
    translateLiveNow("live.now.searchPlaceholder", "tr"),
    "Yayın, yayıncı, kategori veya etiket ara",
  );
  assert.equal(translateLiveNow("live.now.count", "tr", { count: "3" }), "Live Now · 3");
});

test("no Explore Communities string in Live Now catalog", () => {
  const blob = JSON.stringify(LIVE_NOW_LOCALES);
  assert.equal(blob.includes("Explore Communities"), false);
  assert.equal(blob.includes("Toplulukları keşfet"), false);
});
