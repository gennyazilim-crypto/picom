import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "src");
const scannedExtensions = new Set([".ts", ".tsx", ".css"]);
const forbiddenPatterns = [
  /bottom[-_ ]nav/i,
  /mobile[-_ ]nav/i,
  /mobile[-_ ]layout/i,
  /mobile[-_ ]header/i,
  /hamburger/i,
  /touch[-_ ]only/i,
  /@media\s*\([^)]*max-width\s*:\s*(600|640|700|768|800|900)px/i
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

for (const file of walk(sourceRoot)) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(source)) {
      findings.push(`${relative(root, file)}: ${pattern}`);
    }
  }
}

if (findings.length) {
  throw new Error(`Mobile/web-first UI pattern found in desktop MVP source:\n${findings.join("\n")}`);
}

console.log("✓ desktop-only source scan");
console.log("✓ no mobile navigation/layout patterns");
console.log("✓ desktop-only smoke test completed");
