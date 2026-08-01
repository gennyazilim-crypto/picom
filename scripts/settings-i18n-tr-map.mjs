/**
 * Full Turkish catalog for settings i18n (from assembled partial).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import partial from "./settings-i18n-tr-partial.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnKeys() {
  const i18nSrc = readFileSync(path.join(root, "src/services/settings/settingsI18n.ts"), "utf8");
  const modalSrc = readFileSync(path.join(root, "src/services/settings/settingsModalEn.ts"), "utf8");
  const baseKeys = [...i18nSrc.match(/const en = \{([\s\S]*?)\} as const;/)[1].matchAll(/"([^"]+)":/g)].map((m) => m[1]);
  const modalKeys = [...modalSrc.matchAll(/"([^"]+)":/g)].map((m) => m[1]);
  return new Set([...baseKeys, ...modalKeys]);
}

const enKeys = parseEnKeys();
const missing = [...enKeys].filter((k) => !(k in partial)).sort();
if (missing.length) {
  console.error("Missing TR entries:", missing.length);
  console.error(missing.slice(0, 30).join("\n"));
  process.exit(1);
}

export default partial;
