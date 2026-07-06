import fs from "node:fs";
import path from "node:path";

const isSmoke = process.argv.includes("--smoke");
const docPath = "docs/bundle-size.md";
const distAssetsPath = "dist/assets";

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

if (isSmoke) {
  const doc = fs.readFileSync(docPath, "utf8");
  const required = [
    "Dependency and Bundle Size Audit",
    "Initial renderer JavaScript target",
    "npm run bundle:size:audit",
    "Heavy dependency watchlist",
    "CI placeholder",
    "Vite currently reports a chunk-size warning",
  ];
  const missing = required.filter((item) => !doc.includes(item));
  if (missing.length > 0) {
    console.error(`Bundle size documentation is missing: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("Bundle size audit smoke test passed.");
  process.exit(0);
}

if (!fs.existsSync(distAssetsPath)) {
  console.log("dist/assets not found. Run npm run build before npm run bundle:size:audit.");
  process.exit(0);
}

const entries = fs.readdirSync(distAssetsPath)
  .map((name) => {
    const fullPath = path.join(distAssetsPath, name);
    const stat = fs.statSync(fullPath);
    return { name, bytes: stat.size };
  })
  .filter((entry) => entry.bytes > 0)
  .sort((a, b) => b.bytes - a.bytes);

console.log("Picom bundle size audit");
console.log("========================");
for (const entry of entries) {
  const warning = entry.bytes > 500 * 1024 ? "  warning: over 500 KB" : "";
  console.log(`${entry.name.padEnd(44)} ${formatKb(entry.bytes)}${warning}`);
}

const total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
console.log("------------------------");
console.log(`Total dist/assets size: ${formatKb(total)}`);
console.log("Review docs/bundle-size.md before adding heavy dependencies.");
