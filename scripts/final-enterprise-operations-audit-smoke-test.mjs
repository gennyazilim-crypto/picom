import fs from "node:fs";

const requiredFiles = [
  "docs/enterprise-sso-saml.md",
  "docs/scim-provisioning.md",
  "docs/enterprise-audit-export.md",
  "docs/enterprise-data-retention-policy.md",
  "docs/enterprise-legal-hold.md",
  "docs/enterprise-deployment-model.md",
  "docs/enterprise-admin-console.md",
  "docs/enterprise-billing.md",
  "docs/enterprise-support-runbook.md",
  "docs/final-production-launch-audit.md",
  "docs/go-no-go-checklist.md",
];
const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file));
const audit = fs.readFileSync("docs/final-enterprise-operations-audit.md", "utf8");
const requiredSections = [
  "Status summary",
  "Enterprise readiness checklist",
  "Operations readiness checklist",
  "What is intentionally not implemented",
  "Critical blockers before public production",
  "Enterprise-specific blockers",
  "Recommended next 10 tasks",
  "not ready for public production launch",
];
const missingSections = requiredSections.filter((section) => !audit.includes(section));
if (missingFiles.length > 0 || missingSections.length > 0) {
  console.error(`Final enterprise operations audit missing files=${missingFiles.join(", ")} sections=${missingSections.join(", ")}`);
  process.exit(1);
}
console.log("Final enterprise and operations audit smoke test passed.");
