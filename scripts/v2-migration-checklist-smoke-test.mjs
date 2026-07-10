import { readFile } from "node:fs/promises";

const [doc, deployment, rc, packageJson] = await Promise.all([
  readFile("docs/release/v2-migration-checklist.md", "utf8"),
  readFile("docs/production-deployment-checklist.md", "utf8"),
  readFile("docs/release-candidate-dry-run.md", "utf8"),
  readFile("package.json", "utf8"),
]);
const checks = [
  [doc.includes("DB backup alone does not restore attachment bytes") && doc.includes("backup:verify:smoke"), "backup verification"],
  [doc.includes("previous release schema") && doc.includes("clean disposable database") && doc.includes("partial-apply"), "database migration"],
  [doc.includes("cross-community/private-channel denial") && doc.includes("live RLS evidence"), "staging RLS"],
  [doc.includes("Settings schema `3`") && doc.includes("local-data manifest `2`") && doc.includes("auth/session data is untouched"), "client migration"],
  [doc.includes("forward-fix-only") && doc.includes("No down migration") && doc.includes("rollback window"), "rollback"],
  [doc.includes("Windows, Linux, and macOS") && doc.includes("No-Go") && doc.includes("Legal"), "release gate"],
  [deployment.includes("docs/release/v2-migration-checklist.md") && rc.includes("docs/release/v2-migration-checklist.md"), "release links"],
  [packageJson.includes('"release:v2:migration:checklist:smoke"'), "package script"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
