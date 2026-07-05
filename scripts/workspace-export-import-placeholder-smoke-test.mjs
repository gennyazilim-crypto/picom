import fs from "node:fs";

const doc = fs.readFileSync("docs/workspace-export-import-placeholder.md", "utf8");
const required = [
  "post-MVP placeholder",
  "Must not export",
  "auth tokens",
  "Show preview before applying",
  "Supabase/RLS",
  "enableWorkspaceConfigImportExport",
  "documentation-only"
];

const missing = required.filter((needle) => !doc.includes(needle));
if (missing.length) {
  console.error(`Workspace export/import placeholder doc is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Workspace export/import placeholder smoke passed.");
