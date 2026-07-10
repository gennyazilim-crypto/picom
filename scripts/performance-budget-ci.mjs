import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const ASSETS_DIR = "dist/assets";
const KB = 1024;
const budgets = Object.freeze({
  initialJs: { target: 1200 * KB, hard: 1650 * KB, owner: "desktop-frontend", exception: "Split LiveKit and optional admin/profile surfaces before stable release." },
  css: { target: 180 * KB, hard: 240 * KB, owner: "design-system", exception: "Consolidate legacy component styles before stable release." },
  largestImage: { target: 768 * KB, hard: 1024 * KB, owner: "desktop-brand", exception: "Optimize source logo/large local artwork before stable packaging." },
  totalAssets: { target: 2800 * KB, hard: 3500 * KB, owner: "desktop-frontend", exception: "Track total renderer assets while optional chunks are split." },
});

function format(bytes) { return `${(bytes / KB).toFixed(1)} KiB`; }
function classify(name) { if (name.endsWith(".js")) return "js"; if (name.endsWith(".css")) return "css"; if (/\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(name)) return "image"; return "other"; }

let names;
try { names = await readdir(ASSETS_DIR); } catch { console.error("FAIL: dist/assets is missing. Run npm run build first."); process.exit(1); }
const files = await Promise.all(names.map(async (name) => ({ name, bytes: (await stat(path.join(ASSETS_DIR, name))).size, type: classify(name) })));
const measurements = {
  initialJs: files.filter((file) => file.type === "js").reduce((sum, file) => sum + file.bytes, 0),
  css: files.filter((file) => file.type === "css").reduce((sum, file) => sum + file.bytes, 0),
  largestImage: Math.max(0, ...files.filter((file) => file.type === "image").map((file) => file.bytes)),
  totalAssets: files.reduce((sum, file) => sum + file.bytes, 0),
};

let failed = false;
console.log("Picom CI performance budget");
for (const [key, value] of Object.entries(measurements)) {
  const budget = budgets[key];
  if (value > budget.hard) { failed = true; console.error(`FAIL: ${key} ${format(value)} exceeds hard cap ${format(budget.hard)}.`); }
  else if (value > budget.target) console.warn(`WARN: ${key} ${format(value)} exceeds target ${format(budget.target)} but remains below hard cap ${format(budget.hard)}. Owner: ${budget.owner}. Exception: ${budget.exception}`);
  else console.log(`PASS: ${key} ${format(value)} <= target ${format(budget.target)}.`);
}
console.log(`Measured ${files.length} generated asset files.`);
if (failed) process.exit(1);
