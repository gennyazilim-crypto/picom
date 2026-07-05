import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scannedRoots = ["src", "electron", "assets"].filter((path) => existsSync(resolve(root, path)));
const scannedExtensions = new Set([".ts", ".tsx", ".cts", ".mts", ".js", ".mjs", ".css", ".html", ".svg", ".json", ".yml", ".yaml"]);
const forbiddenPatterns = [
  /\bdiscord\b/i,
  /#5865f2/i,
  /#7289da/i,
  /#36393f/i,
  /#2f3136/i,
  /discordapp/i,
  /discordcdn/i
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

for (const scannedRoot of scannedRoots) {
  for (const file of walk(resolve(root, scannedRoot))) {
    const source = readFileSync(file, "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(source)) {
        findings.push(`${relative(root, file)}: ${pattern}`);
      }
    }
  }
}

if (findings.length) {
  throw new Error(`Forbidden branding reference found:\n${findings.join("\n")}`);
}

console.log("✓ Picom runtime branding scan");
console.log("✓ no Discord branding/assets/exact colors in runtime files");
console.log("✓ branding smoke test completed");
