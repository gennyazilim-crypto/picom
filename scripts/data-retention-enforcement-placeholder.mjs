#!/usr/bin/env node

const applyRequested = process.argv.includes("--apply");
const explicitConfirmation = process.argv.includes("--confirm-retention");
const destructiveEnvEnabled = process.env.PICOM_ALLOW_DESTRUCTIVE_MAINTENANCE === "true";

const plan = {
  mode: applyRequested ? "apply_requested_but_not_implemented" : "dry_run",
  destructiveExecutionEnabled: false,
  policySource: "approved_versioned_policy_required",
  backupVerification: "required_before_apply",
  legalHoldCheck: "required_before_apply",
  categories: {
    activeMessages: "retain_until_approved_policy",
    deletedMessages: "candidate_only_after_approved_window_and_grace_period",
    attachments: "coordinate_metadata_original_thumbnail_and_quarantine",
    applicationLogs: "bounded_and_redacted_separate_policy",
    auditLogs: "excluded_from_message_retention",
  },
  candidates: {
    messages: 0,
    attachments: 0,
    storageObjects: 0,
    logs: 0,
    auditLogs: 0,
  },
};

if (applyRequested) {
  if (!destructiveEnvEnabled || !explicitConfirmation) {
    console.error("Retention apply is blocked. Set PICOM_ALLOW_DESTRUCTIVE_MAINTENANCE=true and pass --confirm-retention only in an approved isolated environment.");
    process.exit(2);
  }

  console.error("Retention apply is intentionally not implemented. This placeholder never deletes database rows, storage objects, logs, or audit records.");
  process.exit(3);
}

console.log(JSON.stringify(plan, null, 2));
