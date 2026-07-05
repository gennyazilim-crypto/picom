import { readFileSync } from "node:fs";

const script = readFileSync("scripts/create-admin-user-placeholder.mjs", "utf8");
const docs = readFileSync("docs/admin-user-bootstrap.md", "utf8");
const adminPanelDocs = readFileSync("docs/admin-operations-placeholder.md", "utf8");

const checks = [
  [script.includes("requireDestructiveConfirmation"), "bootstrap script requires destructive confirmation"],
  [script.includes("rawPasswordAccepted: false"), "bootstrap script rejects raw passwords"],
  [script.includes("app_admins"), "bootstrap script points at app_admins authorization"],
  [docs.includes("Do not pass raw passwords"), "docs ban raw password handling"],
  [docs.includes("Supabase Auth"), "docs reference Supabase Auth bootstrap"],
  [docs.includes("app_admins"), "docs describe app_admins table placeholder"],
  [docs.includes("must not run automatically"), "docs document no automatic production bootstrap"],
  [adminPanelDocs.includes("app-admin authorization"), "admin panel docs require app-admin authorization"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  throw new Error(`Admin bootstrap smoke test failed: ${failed.join(", ")}`);
}

console.log("Admin bootstrap smoke test passed.");
