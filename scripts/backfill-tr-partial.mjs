/**
 * One-shot repair: the Turkish partial (scripts/settings-i18n-tr-partial.mjs) drifted
 * behind the generated catalog (src/services/settings/settingsI18nTr.ts) — keys added to
 * the `en` table over time were written into the generated file but never back into the
 * partial, so build-settings-tr.mjs could no longer reproduce it.
 *
 * Copies any key present in the generated catalog but missing from the partial back into
 * the partial, so the partial becomes the complete source of truth again.
 * Idempotent. Usage: node scripts/backfill-tr-partial.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedPath = path.join(root, "src/services/settings/settingsI18nTr.ts");
const partialPath = path.join(root, "scripts/settings-i18n-tr-partial.mjs");

const generated = readFileSync(generatedPath, "utf8");
const entryPattern = /^ {2}"([^"]+)": "((?:\\.|[^"\\])*)",$/gm;
const generatedEntries = [...generated.matchAll(entryPattern)].map((m) => [m[1], m[2]]);

const partial = readFileSync(partialPath, "utf8");
const present = new Set([...partial.matchAll(/^ {2}"([^"]+)":/gm)].map((m) => m[1]));

const missing = generatedEntries.filter(([key]) => !present.has(key));
if (!missing.length) {
  console.log("tr partial already complete; nothing to backfill.");
} else {
  const lines = missing.map(([key, value]) => `  "${key}": "${value}",`).join("\n");
  const closing = partial.lastIndexOf("};");
  if (closing === -1) throw new Error("could not find closing brace in tr partial");
  writeFileSync(partialPath, `${partial.slice(0, closing)}${lines}\n${partial.slice(closing)}`);
  console.log(`backfilled ${missing.length} keys into tr partial:`);
  console.log(missing.map(([k]) => k).join(", "));
}
