import fs from "node:fs";

const auditPath = "docs/final-production-launch-audit.md";
const audit = fs.readFileSync(auditPath, "utf8");
const requiredFiles = [
  "docs/slo.md",
  "docs/incident-response.md",
  "docs/postmortem-template.md",
  "docs/staging-smoke-test.md",
  "docs/production-deployment-checklist.md",
  "docs/rollback-runbook.md",
  "docs/backup-verification.md",
  "docs/database-restore-drill.md",
  "docs/data-corruption-detection.md",
  "docs/secrets-management.md",
  "docs/secret-scanning.md",
  "docs/dependency-vulnerability-policy.md",
  "docs/database-connection-pooling.md",
  "docs/api-request-timeout-retry.md",
  "docs/realtime-backpressure.md",
  "docs/message-send-queue-ordering.md",
  "docs/update-failure-recovery.md",
  "docs/release-candidate-dry-run.md",
  "docs/go-no-go-checklist.md",
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file));
const requiredAudit = [
  "Current status summary",
  "Critical operational gaps before public production",
  "MVP stability notes",
  "Recommended final tasks in priority order",
  "Final audit decision",
  "not ready for public production launch",
];
const missingAudit = requiredAudit.filter((item) => !audit.includes(item));

if (missingFiles.length > 0 || missingAudit.length > 0) {
  console.error(`Final production audit missing files=${missingFiles.join(", ")} audit=${missingAudit.join(", ")}`);
  process.exit(1);
}

console.log("Final production launch audit smoke test passed.");
