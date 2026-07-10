import { readFile } from "node:fs/promises";

const [doc, generic, packageJson] = await Promise.all([
  readFile("docs/release/stable-v2-go-no-go.md", "utf8"),
  readFile("docs/go-no-go-checklist.md", "utf8"),
  readFile("package.json", "utf8"),
]);
const checks = [
  [doc.includes("No-Go / Delay pending blocker verification") && doc.includes("Automatic release/publish/update action: **none**"), "honest decision"],
  [doc.includes("External security review not commissioned/completed") && doc.includes("External accessibility audit not performed"), "external audits"],
  [doc.includes("Live RLS/tenant isolation not proven") && doc.includes("Backup restore not production-proven"), "security and restore"],
  [doc.includes("Windows signing/macOS notarization incomplete") && doc.includes("Platform packages not release-proven"), "platform artifacts"],
  [doc.includes("Legal/privacy publication not approved") && doc.includes("Required sign-offs absent"), "legal and signoffs"],
  [doc.includes("prepared in documentation, not demonstrated for this RC") && doc.includes("forward-fix-only"), "rollback readiness"],
  [doc.includes("Vite renderer chunk") && doc.includes("auto-update remains disabled"), "non-blockers"],
  [generic.includes("docs/release/stable-v2-go-no-go.md") && packageJson.includes('"release:v2:go-no-go:smoke"'), "linked gate"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
