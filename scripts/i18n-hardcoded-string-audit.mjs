/**
 * Hardcoded user-facing string audit.
 *
 * Scans the renderer (src/**\/*.{ts,tsx}) and the Electron main process
 * (electron/**\/*.cts) for user-visible text that is written inline instead of resolved
 * through a translation key, and exits non-zero when it finds real hits.
 *
 * Covered patterns:
 *   - JSX text nodes                       <p>Some text</p>
 *   - title / placeholder / alt attributes title="Some text"
 *   - aria-label / aria-description        aria-label="Some text"
 *   - toast / dialog / notification calls  pushToast("Some text"), showMessageBox({ message: "..." })
 *   - Electron menu / tray / dialog labels label: "Some text"
 *   - template literals in those positions `Some ${x} text`
 *   - string concatenation building a user sentence  "Some " + x + " text"
 *
 * Known false negatives (stated so the audit is not mistaken for full static analysis):
 *   - Text assembled across variables far from its render site.
 *   - Strings returned from service layers and rendered verbatim elsewhere.
 *   - Text inside dynamically-built objects (config maps, arrays) that are not in one of
 *     the recognised user-facing positions.
 *   - Regex-based JSX parsing cannot resolve conditional/nested expressions perfectly.
 *   A future AST-based pass (ts-morph / typescript compiler API) would close these.
 *
 * Usage: node scripts/i18n-hardcoded-string-audit.mjs [--report]
 *   --report prints every finding grouped by file instead of only the first 40.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["src", "electron"];
const EXTENSIONS = new Set([".ts", ".tsx", ".cts"]);

/**
 * Files excluded from the scan. Each entry must be a genuinely non-user-facing module or
 * a translation catalog (the catalogs ARE the strings). Feature-flagged-off product UI,
 * admin surfaces, and restricted panels are deliberately NOT excluded.
 */
const EXCLUDED_PATHS = [
  // Translation catalogs and the i18n runtime itself: these legitimately contain the text.
  "src/i18n/",
  "src/services/settings/settingsI18n",
  "src/services/settings/settingsModalEn.ts",
  "src/services/localization/",
  "electron/mainLocale.cts",
  // Type declarations carry no runtime text.
  ".d.ts",
  // Generated Supabase contract: every literal is a column name / enum value, not UI copy.
  "src/services/supabase/database.types.ts",
  // Seed/demo data standing in for user-generated content (community names, story titles,
  // track names). Per spec, user content is never translated.
  "src/data/mock",
  // Game-title proper nouns for rich presence detection (Valorant, CS2, ...). Brand names.
  "electron/activityPresence.cts",
  // Tests and fixtures.
  ".test.ts",
  ".test.tsx",
  "__tests__/",
  "__fixtures__/",
];

/**
 * Value-level allowlist: only genuinely technical strings.
 * Every entry is narrow and justified.
 */
const TECHNICAL_VALUE_PATTERNS = [
  { re: /^[a-z0-9]+(-[a-z0-9]+)*$/, why: "CSS class / kebab-case token" },
  { re: /^[a-zA-Z0-9_]+$/, why: "single identifier / enum / DB field / event name" },
  { re: /^\//, why: "route or filesystem path" },
  { re: /^https?:\/\//, why: "URL" },
  { re: /^[a-z]+:\/\//, why: "protocol URI (picom://, file://)" },
  { re: /^[a-z]+\/[a-z0-9.+-]+$/i, why: "MIME type" },
  { re: /^[A-Z][A-Z0-9_]{2,}$/, why: "SCREAMING_SNAKE constant / error code" },
  { re: /^[\d\s.,:%+\-/()[\]{}<>|#@*~`^&=$"'\\]*$/, why: "punctuation / numeric only" },
  { re: /^(PICOM|Picom|LiveKit|Supabase|Electron|Chromium|Windows|Linux|macOS|Node|React|Vite)\b/, why: "brand / product name" },
  { re: /^#[0-9a-fA-F]{3,8}$/, why: "colour literal" },
  { re: /^\s*$/, why: "whitespace" },
];

/** Call expressions whose first string argument is developer-facing, not user-facing. */
const NON_USER_CALLS = /\b(console\.(log|warn|error|info|debug|trace)|logger?\.(log|warn|error|info|debug)|captureException|track|trackEvent|analytics\.\w+|new Error|throw new \w*Error|assert\w*|describe|it|test|expect|require|import|querySelector\w*|getElementById|setAttribute|getAttribute|addEventListener|removeEventListener|matchMedia|createElement|localStorage\.\w+|sessionStorage\.\w+|JSON\.\w+|Object\.\w+|Intl\.\w+)\s*\(/;

const findings = [];

function isExcluded(file) {
  const normalized = file.replace(/\\/g, "/");
  return EXCLUDED_PATHS.some((fragment) => normalized.includes(fragment));
}

function isTechnicalValue(value) {
  const trimmed = value.trim();
  if (trimmed.length < 3) return true;
  // A user-facing sentence has at least two words or ends with sentence punctuation.
  const looksLikeProse = /\s/.test(trimmed) || /[.!?…]$/.test(trimmed);
  if (!looksLikeProse && /^[a-zA-Z0-9_.-]+$/.test(trimmed)) return true;
  return TECHNICAL_VALUE_PATTERNS.some(({ re }) => re.test(trimmed));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "dist-electron" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(entry))) out.push(full);
  }
  return out;
}

function record(file, lineNumber, kind, value) {
  findings.push({ file: file.replace(/\\/g, "/"), line: lineNumber, kind, value: value.trim().slice(0, 100) });
}

function auditFile(file) {
  const source = readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    // A line already resolving through a translation function is compliant.
    const usesTranslation = /\bt\(|translateSettings|translateMain|translateLiveNow|translatePublisherProgram|useTranslation/.test(line);

    // 1. User-facing attributes.
    for (const match of line.matchAll(/\b(title|placeholder|alt|aria-label|aria-description|aria-valuetext)\s*=\s*"([^"]{3,})"/g)) {
      if (isTechnicalValue(match[2])) continue;
      record(file, lineNumber, `attribute:${match[1]}`, match[2]);
    }

    // 2. JSX text nodes: >Some text<
    for (const match of line.matchAll(/>([^<>{}\n]{3,})</g)) {
      const text = match[1];
      if (!/[a-zA-Z]{2,}/.test(text)) continue;
      if (isTechnicalValue(text)) continue;
      record(file, lineNumber, "jsx-text", text);
    }

    // 3. Toast / dialog / notification / validation message calls.
    for (const match of line.matchAll(/\b(pushToast|showToast|toast|setError|setStatus|setNotice|setMessage|showMessageBox|showErrorBox|notify|setValidationError|confirm|alert)\s*\(\s*"([^"]{3,})"/g)) {
      if (isTechnicalValue(match[2])) continue;
      record(file, lineNumber, `call:${match[1]}`, match[2]);
    }

    // 4. Object properties that render as user text (Electron menus, dialogs, toasts).
    for (const match of line.matchAll(/\b(label|message|detail|body|buttonLabel|checkboxLabel|emptyTitle|emptyBody|tooltip|caption|heading|subtitle|description)\s*:\s*"([^"]{3,})"/g)) {
      if (isTechnicalValue(match[2])) continue;
      if (usesTranslation) continue;
      record(file, lineNumber, `property:${match[1]}`, match[2]);
    }

    // 5. Template literals in user-facing positions.
    for (const match of line.matchAll(/\b(title|placeholder|alt|aria-label|label|message|body|tooltip)\s*=?\s*:?\s*\{?`([^`]{3,})`/g)) {
      const text = match[2];
      if (!/[a-zA-Z]{3,}/.test(text)) continue;
      const literalPart = text.replace(/\$\{[^}]*\}/g, " ").trim();
      if (!literalPart || isTechnicalValue(literalPart)) continue;
      if (usesTranslation) continue;
      record(file, lineNumber, "template-literal", text);
    }

    // 6. String concatenation building a sentence: "Some text " + variable
    for (const match of line.matchAll(/"([^"]{4,})"\s*\+\s*[A-Za-z_$]/g)) {
      const text = match[1];
      if (NON_USER_CALLS.test(line)) continue;
      if (isTechnicalValue(text)) continue;
      if (!/\s/.test(text)) continue;
      if (usesTranslation) continue;
      record(file, lineNumber, "string-concat", text);
    }
  });
}

const files = ROOTS.flatMap((root) => walk(root)).filter((file) => !isExcluded(file));
for (const file of files) auditFile(file);

const reportAll = process.argv.includes("--report");
const byFile = new Map();
for (const finding of findings) {
  if (!byFile.has(finding.file)) byFile.set(finding.file, []);
  byFile.get(finding.file).push(finding);
}
const ranked = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`Scanned ${files.length} source files across ${ROOTS.join(", ")}.`);

if (!findings.length) {
  console.log("i18n hardcoded-string audit: PASS — no untranslated user-facing strings detected.");
  process.exit(0);
}

console.error(`i18n hardcoded-string audit: FAIL — ${findings.length} untranslated user-facing string(s) in ${byFile.size} file(s).`);
const shown = reportAll ? ranked : ranked.slice(0, 40);
for (const [file, entries] of shown) {
  console.error(`\n  ${file} (${entries.length})`);
  for (const entry of (reportAll ? entries : entries.slice(0, 5))) {
    console.error(`    ${entry.line}: [${entry.kind}] ${entry.value}`);
  }
  if (!reportAll && entries.length > 5) console.error(`    … ${entries.length - 5} more in this file`);
}
if (!reportAll && ranked.length > 40) {
  console.error(`\n  … and ${ranked.length - 40} more file(s). Re-run with --report for the full list.`);
}
process.exit(1);
