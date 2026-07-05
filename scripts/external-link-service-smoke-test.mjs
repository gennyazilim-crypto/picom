import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalService = "src/services/desktop/externalLinkService.ts";
const compatibilityService = "src/services/externalLinkService.ts";
const canonicalSource = readFileSync(resolve(root, canonicalService), "utf8");
const compatibilitySource = readFileSync(resolve(root, compatibilityService), "utf8");
const messageItemSource = readFileSync(resolve(root, "src/components/MessageItem.tsx"), "utf8");
const docSource = readFileSync(resolve(root, "docs/external-links.md"), "utf8");

const requiredServiceSnippets = [
  "export function normalizeUrl",
  "export function isSafeUrl",
  "export function getDisplayDomain",
  "export async function confirmExternalUrlPlaceholder",
  "export async function openExternalUrl",
  "allowedProtocols = new Set([\"http:\", \"https:\"])",
  "window.picomDesktop?.externalLinks?.openUrl",
  "window.open(url, \"_blank\", \"noopener,noreferrer\")",
];

for (const snippet of requiredServiceSnippets) {
  if (!canonicalSource.includes(snippet)) {
    throw new Error(`External link service missing required snippet: ${snippet}`);
  }
}

if (!compatibilitySource.includes("./desktop/externalLinkService")) {
  throw new Error("Compatibility externalLinkService path must re-export the desktop service.");
}

if (!messageItemSource.includes("../services/desktop/externalLinkService") || !messageItemSource.includes("message-link-button")) {
  throw new Error("Message links must route through the desktop externalLinkService.");
}

for (const phrase of ["javascript:", "file:", "data:", "deepLinkService", "shell.openExternal only through the safe preload/IPC bridge"]) {
  if (!docSource.includes(phrase)) {
    throw new Error(`External link docs missing required phrase: ${phrase}`);
  }
}

const forbiddenRawOpenPatterns = [/\bwindow\.open\s*\(/, /\bshell\.openExternal\s*\(/];
const allowedRawOpenFiles = new Set([
  canonicalService,
  "electron/main.cts",
]);

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, files);
    } else if (/\.(ts|tsx|cts)$/.test(path)) {
      files.push(path);
    }
  }
  return files;
}

const findings = [];
for (const file of [...walk(resolve(root, "src")), ...walk(resolve(root, "electron"))]) {
  const relativePath = relative(root, file).replace(/\\/g, "/");
  if (allowedRawOpenFiles.has(relativePath)) continue;
  const source = readFileSync(file, "utf8");
  for (const pattern of forbiddenRawOpenPatterns) {
    if (pattern.test(source)) {
      findings.push(`${relativePath}: ${pattern}`);
    }
  }
}

if (findings.length > 0) {
  throw new Error(`Raw external opening found outside approved services:\n${findings.join("\n")}`);
}

console.log("Safe external link service smoke test passed.");
