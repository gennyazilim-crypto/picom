/**
 * Settings i18n production gate: EN/TR parity, JSX UX scan (no TS runtime import).
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseQuotedStrings(tsSource) {
  return Object.fromEntries(
    [...tsSource.matchAll(/"([^"]+)":\s*\n?\s*"((?:\\.|[^"\\])*)"/g)].map((m) => [
      m[1],
      m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\"),
    ]),
  );
}

const i18nSrc = readFileSync(path.join(root, "src/services/settings/settingsI18n.ts"), "utf8");
const modalSrc = readFileSync(path.join(root, "src/services/settings/settingsModalEn.ts"), "utf8");
const trSrc = readFileSync(path.join(root, "src/services/settings/settingsI18nTr.ts"), "utf8");

const baseEn = parseQuotedStrings(i18nSrc.match(/const en = \{([\s\S]*?)\} as const;/)[1]);
const modalEn = parseQuotedStrings(modalSrc);
const enKeys = new Set([...Object.keys(baseEn), ...Object.keys(modalEn)]);
const trKeys = new Set([...trSrc.matchAll(/"([^"]+)":/g)].map((m) => m[1]));

const missingInTr = [...enKeys].filter((k) => !trKeys.has(k)).sort();
const missingInEn = [...trKeys].filter((k) => !enKeys.has(k)).sort();
assert.equal(missingInTr.length, 0, `missing TR: ${missingInTr.slice(0, 10).join(", ")}`);
assert.equal(missingInEn.length, 0, `extra TR: ${missingInEn.slice(0, 10).join(", ")}`);
console.log("PASS: settings i18n EN/TR key parity");
console.log(`INFO: settings catalog key count ${enKeys.size}`);

const enCatalog = { ...baseEn, ...modalEn };
const trCatalog = parseQuotedStrings(trSrc.match(/export const settingsI18nTr[^=]*=\s*\{([\s\S]*?)\};/)[1]);
const mirrored = [];
for (const key of enKeys) {
  const enVal = enCatalog[key];
  const trVal = trCatalog[key];
  if (enVal && trVal && enVal === trVal && /\s/.test(enVal) && enVal.length > 10 && !enVal.startsWith("http") && key !== "appearance.option.langEn") {
    mirrored.push(key);
  }
}
assert.equal(mirrored.length, 0, `TR mirrors EN (${mirrored.length}): ${mirrored.slice(0, 15).join(", ")}`);
console.log("PASS: no TR/EN mirror for user-facing keys");

/** @type {ReadonlySet<string>} */
const ALLOWLIST_SUBSTRINGS = new Set([
  "Simulate available",
  "Simulate download",
  "Simulate ready",
  "Simulate download failure",
  "Simulate install failure",
  "Simulate error",
  "Simulate rollback",
  "Simulate tray settings",
  "Simulate menu palette",
  "Capture test error safely",
  "Show crash report status",
  "Reset first-launch setup",
  "Terms of Service",
  "Privacy Policy",
  "Community Guidelines",
  "Cookie Policy",
  "Picom beta feedback",
]);

const SCAN_FILES = [
  path.join(root, "src/components/SettingsModal.tsx"),
  ...collectTsx(path.join(root, "src/components/settings")),
];

function collectTsx(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectTsx(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const UX_LITERAL =
  /(?:>\s*|aria-label=\{|aria-label="|title="|placeholder="|pushToast\(\s*|window\.confirm\(\s*)["']([A-Za-zÀ-ÖØ-öø-ÿ][^"']{3,})["']/g;
const JSX_TEXT = />\s*([A-Za-z][^<{}]{2,})\s*</g;

function isLikelyUiCopy(text) {
  if (/[=(){};]|useState|useEffect|useRef|useMemo|const |=>|\[\]|translateSettings|settingsService/.test(text)) return false;
  if (/[{}]/.test(text)) return false;
  if (!/^[A-Za-z"“]/.test(text.trim())) return false;
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  if (!/\s/.test(trimmed)) return false;
  return true;
}

const findings = [];

function allowText(text) {
  const trimmed = text.trim();
  if (!/\s/.test(trimmed)) return true;
  if (/^[\d\s./:?\\\-–—%]+$/.test(trimmed)) return true;
  if (trimmed.includes("${")) return true;
  if (trimmed.startsWith("http")) return true;
  if (/^Shortcut:\s*Ctrl \+ Shift/.test(trimmed)) return true;
  if (/^Ctrl \+ Shift \+ [A-ZYCMD]$/.test(trimmed)) return true;
  if (trimmed.includes("VITE_STATUS_PAGE_URL")) return true;
  if ([...ALLOWLIST_SUBSTRINGS].some((allowed) => trimmed.includes(allowed))) return true;
  return false;
}

for (const file of SCAN_FILES) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const src = readFileSync(file, "utf8");
  if (rel.includes("SettingsModal")) {
    for (const m of src.matchAll(/\b(?:aria-label|placeholder)=["']([^"']+)["']/g)) {
      const text = m[1].trim();
      if (text.length >= 2) {
        findings.push({ file: rel, text: text.slice(0, 120), kind: "attr-literal" });
      }
    }
  }
  for (const match of src.matchAll(UX_LITERAL)) {
    const text = match[1].trim();
    if (allowText(text)) continue;
    findings.push({ file: rel, text: text.slice(0, 120) });
  }
  for (const match of src.matchAll(JSX_TEXT)) {
    const text = match[1].trim();
    if (!isLikelyUiCopy(text)) continue;
    if (allowText(text)) continue;
    if (/^(online|idle|busy|offline|main|companion|app|system|light|dark|left|right|top|bottom)$/i.test(text)) continue;
    findings.push({ file: rel, text: text.slice(0, 120), kind: "jsx" });
  }
}

if (findings.length) {
  console.error("FAIL: suspected hardcoded Settings UX strings:");
  for (const row of findings.slice(0, 50)) {
    console.error(`  ${row.file}${row.kind ? ` [${row.kind}]` : ""}: "${row.text}"`);
  }
  if (findings.length > 50) console.error(`  ... and ${findings.length - 50} more`);
  process.exit(1);
}

console.log("PASS: no high-confidence hardcoded Settings UX literals in scan scope");
console.log("settings-i18n-scan: PASS");
