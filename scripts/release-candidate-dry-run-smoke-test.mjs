import fs from "node:fs";

const doc = fs.readFileSync("docs/release-candidate-dry-run.md", "utf8");
const required = [
  "Choose release version",
  "Update changelog",
  "Run quality gate",
  "Run tests",
  "Run database migration on staging",
  "Run staging smoke test",
  "Build Windows package",
  "Build Linux package",
  "Generate checksums",
  "Verify artifact metadata",
  "Install Windows package",
  "Install Linux package",
  "Run desktop smoke test",
  "Verify rollback plan",
  "Prepare release notes",
  "pass / fail / blocked",
  "docs/staging-smoke-test.md",
  "docs/rollback-runbook.md",
];

const missing = required.filter((item) => !doc.includes(item));
if (missing.length > 0) {
  console.error(`Release candidate dry run workflow is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Release candidate dry run smoke test passed.");
