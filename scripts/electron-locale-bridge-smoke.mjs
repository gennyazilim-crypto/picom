// Run with: node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/electron-locale-bridge-smoke.mjs
//
// Anti-drift gate for the Electron main-process locale catalog (electron/mainLocale.cts).
// The main process keeps its own small catalog because it is CommonJS and cannot import
// the renderer's ESM/JSON i18n runtime -- this test is what stops the two from diverging.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

// electron/*.cts is CommonJS and cannot be imported as ESM, so this asserts against the
// compiled main-process bundle. Run `npm run electron:build` first.
const compiled = "dist-electron/mainLocale.cjs";
assert.ok(
  existsSync(compiled),
  `${compiled} not found — run "npm run electron:build" before this smoke test`,
);
const mainLocale = createRequire(import.meta.url)(`../${compiled}`);
const uiLanguages = await import("../src/services/localization/uiLanguages.ts");

const { MAIN_LOCALES, MAIN_LOCALE_CATALOGS, translateMain, normalizeMainLocale, setMainLocale } = mainLocale;
const { SUPPORTED_UI_LANGUAGES } = uiLanguages;

// 1. Electron registry must match the renderer registry exactly (same set, same order).
assert.deepEqual(
  [...MAIN_LOCALES],
  [...SUPPORTED_UI_LANGUAGES],
  "electron/mainLocale.cts MAIN_LOCALES must match SUPPORTED_UI_LANGUAGES exactly",
);
assert.equal(MAIN_LOCALES.length, 10, "expected exactly 10 main-process locales");

// 2. Every locale must expose the identical MainLocaleKey set.
const enKeys = Object.keys(MAIN_LOCALE_CATALOGS.en).sort();
assert.ok(enKeys.length > 0, "English main-process catalog must not be empty");
for (const locale of MAIN_LOCALES) {
  const keys = Object.keys(MAIN_LOCALE_CATALOGS[locale]).sort();
  assert.deepEqual(
    keys,
    enKeys,
    `main-process catalog key set mismatch for "${locale}" (a new key was added without covering every locale)`,
  );
}

// 3. No empty / whitespace-only values in any locale.
for (const locale of MAIN_LOCALES) {
  for (const key of enKeys) {
    const value = MAIN_LOCALE_CATALOGS[locale][key];
    assert.ok(
      typeof value === "string" && value.trim().length > 0,
      `empty main-process value for ${locale}.${key}`,
    );
  }
}

// 4. Report values in non-English locales accidentally left byte-identical to English.
// "Online"/"Invisible" and similar legitimately coincide in some languages, so the
// allowlist is per (locale, key) and each entry is a real linguistic coincidence.
const MIRROR_ALLOW = new Set([
  "de:tray.status.online", // "Online" is the standard German presence term
  "nl:tray.status.online", // "Online" is the standard Dutch presence term
  "fr:tray.status.invisible", // "Invisible" is spelled identically in French
  "es:tray.status.invisible", // "Invisible" is spelled identically in Spanish
]);
const mirrored = [];
for (const locale of MAIN_LOCALES) {
  if (locale === "en") continue;
  for (const key of enKeys) {
    if (MIRROR_ALLOW.has(`${locale}:${key}`)) continue;
    if (MAIN_LOCALE_CATALOGS[locale][key] === MAIN_LOCALE_CATALOGS.en[key]) {
      mirrored.push(`${locale}.${key}`);
    }
  }
}
assert.deepEqual(mirrored, [], `main-process values copied verbatim from English: ${mirrored.join(", ")}`);

// 5. Safe normalization: unsupported/corrupt input degrades to English, never throws.
for (const [input, expected] of [["de-AT", "de"], ["pt-PT", "pt"], ["zz", "en"], [undefined, "en"], [null, "en"], [42, "en"]]) {
  assert.equal(normalizeMainLocale(input), expected, `normalizeMainLocale(${JSON.stringify(input)})`);
}

// 6. setMainLocale actually switches the active catalog and translateMain follows it.
setMainLocale("tr");
assert.equal(translateMain("tray.quit"), MAIN_LOCALE_CATALOGS.tr["tray.quit"], "translateMain must follow setMainLocale");
setMainLocale("ru");
assert.equal(translateMain("tray.settings"), MAIN_LOCALE_CATALOGS.ru["tray.settings"], "translateMain must follow setMainLocale");
setMainLocale("en");

// 7. The IPC bridge wiring must exist end to end (channel -> preload -> main handler).
const channels = readFileSync("electron/ipcChannels.cts", "utf8");
const preload = readFileSync("electron/preload.cts", "utf8");
const main = readFileSync("electron/main.cts", "utf8");
assert.ok(channels.includes("settingsSetLocale"), "ipcChannels.cts must declare settingsSetLocale");
assert.ok(preload.includes("setLocale"), "preload.cts must expose settings.setLocale");
assert.ok(
  main.includes("IPC_CHANNELS.settingsSetLocale"),
  "main.cts must register an ipcMain handler for settingsSetLocale",
);
assert.ok(
  main.includes("setMainLocale") && main.includes("refreshTray"),
  "main.cts locale handler must apply the locale and rebuild the tray without a restart",
);

// 8. The tray menu must not contain the old hardcoded English labels.
for (const stale of ['label: "Open Picom Companion"', 'label: "Set Status"', 'label: "Quit"']) {
  assert.ok(!main.includes(stale), `main.cts still has a hardcoded tray label: ${stale}`);
}

console.log(`Electron locale bridge smoke: PASS (${MAIN_LOCALES.length} locales x ${enKeys.length} keys)`);
