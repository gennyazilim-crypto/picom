import fs from "node:fs";

const doc = fs.readFileSync("docs/stickers-placeholder.md", "utf8");
const required = [
  "post-MVP placeholder",
  "No third-party or copyrighted sticker assets",
  "Supabase storage placeholder",
  "StickerPicker compact popover",
  "manageStickers",
  "documentation-only"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Stickers placeholder doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Stickers placeholder smoke passed.");
