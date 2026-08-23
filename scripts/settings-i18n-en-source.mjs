/**
 * Canonical merged English source for the Settings i18n catalog: base `en` object from
 * settingsI18n.ts plus settingsModalEn.ts, flattened to one key -> English string map.
 * Used by scripts/build-settings-locale.mjs and as the reference translators work from.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnStrings(tsSource, blockPattern) {
  const match = tsSource.match(blockPattern);
  if (!match) throw new Error("expected block not found while parsing settings i18n source");
  return Object.fromEntries(
    [...match[1].matchAll(/"([^"]+)":\s*"((?:\\.|[^"\\])*)"/g)].map((m) => [
      m[1],
      m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
    ]),
  );
}

export function loadEnSettingsSource() {
  const i18nSrc = readFileSync(path.join(root, "src/services/settings/settingsI18n.ts"), "utf8");
  const modalSrc = readFileSync(path.join(root, "src/services/settings/settingsModalEn.ts"), "utf8");
  const base = parseEnStrings(i18nSrc, /const en = \{([\s\S]*?)\} as const;/);
  const modal = parseEnStrings(modalSrc, /export const settingsModalEn = \{([\s\S]*?)\} as const;/);
  return { ...base, ...modal };
}

export default loadEnSettingsSource;
