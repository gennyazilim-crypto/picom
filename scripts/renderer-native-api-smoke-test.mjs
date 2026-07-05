import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rendererRoot = resolve(root, "src");
const scannedExtensions = new Set([".ts", ".tsx"]);
const forbiddenPatterns = [
  /from\s+["']electron["']/,
  /require\(["']electron["']\)/,
  /\bipcRenderer\b/,
  /\bdesktopCapturer\b/,
  /\bshell\.openExternal\b/,
  /\bcontextBridge\b/,
  /\bnodeIntegration\b/,
  /\bwindow\.require\b/,
  /from\s+["']node:/,
  /require\(["']node:/
];

function hasScannedExtension(path) {
  return [...scannedExtensions].some((extension) => path.endsWith(extension));
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      walk(path, files);
    } else if (hasScannedExtension(path)) {
      files.push(path);
    }
  }

  return files;
}

const findings = [];

for (const file of walk(rendererRoot)) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(source)) {
      findings.push(`${relative(root, file)}: ${pattern}`);
    }
  }
}

if (findings.length) {
  throw new Error(`Renderer is using direct native APIs:\n${findings.join("\n")}`);
}

console.log("✓ renderer native API boundary");
console.log("✓ React code uses service/preload abstractions");
console.log("✓ renderer native API smoke test completed");
