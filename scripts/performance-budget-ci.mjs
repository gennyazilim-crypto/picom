import { gzipSync } from "node:zlib";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DIST_DIR = "dist";
const ASSETS_DIR = path.join(DIST_DIR, "assets");
const MANIFEST_PATH = path.join(DIST_DIR, ".vite", "manifest.json");
const REPORT_PATH = path.join(DIST_DIR, "renderer-asset-report.json");
const KB = 1024;
const budgets = Object.freeze({
  initialJs: { target: 1200 * KB, hard: 1650 * KB, owner: "desktop-frontend", exception: "Split LiveKit and optional admin/profile surfaces before stable release." },
  initialCss: { target: 322 * KB, hard: 330 * KB, owner: "design-system", exception: "The current V1 desktop shell baseline includes the authenticated community workspace, global navigation, accessibility, and overlay contracts; any additional global CSS must be split or consolidated." },
  largestImage: { target: 768 * KB, hard: 1024 * KB, owner: "desktop-brand", exception: "Optimize source logo/large local artwork before stable packaging." },
  totalAssets: { target: 3625 * KB, hard: 3700 * KB, owner: "desktop-frontend", exception: "This V1 baseline includes mandatory self-hosted Voice Rooms, Screen Share, meetings, Supabase, DM, Feed, and admin lazy chunks; new scope must remain code-split and stay inside the bounded regression allowance." },
});

function format(bytes) {
  return `${(bytes / KB).toFixed(1)} KiB`;
}

function assetType(name) {
  if (name.endsWith(".js")) return "js";
  if (name.endsWith(".css")) return "css";
  if (/\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(name)) return "image";
  return "other";
}

function assetName(file) {
  return path.posix.basename(file.replaceAll("\\", "/"));
}

let manifest;
try {
  manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
} catch {
  console.error("FAIL: Vite manifest is missing or invalid. Run npm run build with build.manifest enabled.");
  process.exit(1);
}

const manifestEntries = Object.entries(manifest);
const entryKeys = manifestEntries.filter(([, record]) => record.isEntry === true).map(([key]) => key);
if (entryKeys.length === 0) {
  console.error("FAIL: Vite manifest has no renderer entry.");
  process.exit(1);
}

const entryJs = new Set();
const staticJs = new Set();
const initialCss = new Set();
const visited = new Set();

function visitStaticGraph(key, isEntry = false) {
  if (visited.has(key)) return;
  visited.add(key);
  const record = manifest[key];
  if (!record) throw new Error(`Manifest static import is missing: ${key}`);
  if (record.file?.endsWith(".js")) {
    (isEntry ? entryJs : staticJs).add(assetName(record.file));
  }
  for (const cssFile of record.css ?? []) initialCss.add(assetName(cssFile));
  for (const importedKey of record.imports ?? []) visitStaticGraph(importedKey, false);
  // record.dynamicImports is intentionally excluded from the startup graph.
}

for (const entryKey of entryKeys) visitStaticGraph(entryKey, true);

let names;
try {
  names = await readdir(ASSETS_DIR);
} catch {
  console.error("FAIL: dist/assets is missing. Run npm run build first.");
  process.exit(1);
}

const ownerByAsset = new Map();
function addOwner(file, source) {
  if (!file) return;
  const name = assetName(file);
  const owners = ownerByAsset.get(name) ?? new Set();
  owners.add(source);
  ownerByAsset.set(name, owners);
}

for (const [source, record] of manifestEntries) {
  addOwner(record.file, source);
  for (const cssFile of record.css ?? []) addOwner(cssFile, source);
}

const files = await Promise.all(
  names
    .filter((name) => !name.endsWith(".map"))
    .map(async (name) => {
      const filePath = path.join(ASSETS_DIR, name);
      const bytes = (await stat(filePath)).size;
      const gzipBytes = gzipSync(await readFile(filePath)).length;
      const type = assetType(name);
      let classification = type;
      if (type === "js") classification = entryJs.has(name) ? "entry" : staticJs.has(name) ? "static" : "lazy";
      if (type === "css") classification = initialCss.has(name) ? "initial-css" : "lazy-css";
      return {
        name,
        bytes,
        gzipBytes,
        type,
        classification,
        sources: [...(ownerByAsset.get(name) ?? [])].sort(),
      };
    }),
);

function sumWhere(predicate) {
  return files.filter(predicate).reduce((sum, file) => sum + file.bytes, 0);
}

function maxWhere(predicate) {
  return Math.max(0, ...files.filter(predicate).map((file) => file.bytes));
}

const measurements = {
  initialJs: sumWhere((file) => file.classification === "entry" || file.classification === "static"),
  initialCss: sumWhere((file) => file.classification === "initial-css"),
  lazyJsTotal: sumWhere((file) => file.classification === "lazy"),
  lazyCssTotal: sumWhere((file) => file.classification === "lazy-css"),
  largestJsChunk: maxWhere((file) => file.type === "js"),
  largestCssChunk: maxWhere((file) => file.type === "css"),
  largestImage: maxWhere((file) => file.type === "image"),
  totalAssets: files.reduce((sum, file) => sum + file.bytes, 0),
};

let failed = false;
console.log("Picom CI performance budget");
console.log("Measurement: raw bytes from the Vite entry/static graph; gzip is informational; dynamic imports and source maps are excluded from initial load.");
for (const key of ["initialJs", "initialCss", "largestImage", "totalAssets"]) {
  const value = measurements[key];
  const budget = budgets[key];
  if (value > budget.hard) {
    failed = true;
    console.error(`FAIL: ${key} ${format(value)} exceeds hard cap ${format(budget.hard)}.`);
  } else if (value > budget.target) {
    console.warn(`WARN: ${key} ${format(value)} exceeds target ${format(budget.target)} but remains below hard cap ${format(budget.hard)}. Owner: ${budget.owner}. Exception: ${budget.exception}`);
  } else {
    console.log(`PASS: ${key} ${format(value)} <= target ${format(budget.target)}.`);
  }
}

console.log(`INFO: lazyJsTotal ${format(measurements.lazyJsTotal)}.`);
console.log(`INFO: lazyCssTotal ${format(measurements.lazyCssTotal)}.`);
console.log(`INFO: largestJsChunk ${format(measurements.largestJsChunk)}.`);
console.log(`INFO: largestCssChunk ${format(measurements.largestCssChunk)}.`);
console.log(`Measured ${files.length} generated asset files.`);
console.log("Renderer asset inventory (classification | raw | gzip | file | source):");
for (const file of [...files].sort((left, right) => right.bytes - left.bytes)) {
  console.log(`${file.classification.padEnd(11)} | ${format(file.bytes).padStart(10)} | ${format(file.gzipBytes).padStart(10)} | ${file.name} | ${file.sources.join(", ") || "unmapped asset"}`);
}

await writeFile(
  REPORT_PATH,
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    basis: "raw bytes; Vite entry plus recursive static imports; dynamic imports and source maps excluded from initial load; gzip informational",
    entryKeys,
    measurements,
    budgets,
    assets: files,
  }, null, 2)}\n`,
  "utf8",
);

if (failed) process.exit(1);
