import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803220000_business_application_verification_and_team_management.sql"), "utf8");
const edge = await readFile(resolve(root, "supabase/functions/business-document-upload-session/index.ts"), "utf8");
for (const value of ["business-verification-documents", "application/pdf", "image/jpeg", "image/png", "image/webp"]) {
  if (!migration.includes(value) || !edge.includes(value)) throw new Error(`Storage contract missing ${value}`);
}
if (!/svg\|exe/i.test(edge)) throw new Error("Upload endpoint must reject SVG and executable filenames.");
console.log("Business application storage contract passed.");
