import { readFile } from "node:fs/promises";

const [workflow, verifier, builder, docs, packageText] = await Promise.all([
  readFile(".github/workflows/windows-signed-release.yml", "utf8"),
  readFile("scripts/verify-windows-signature.ps1", "utf8"),
  readFile("electron-builder.yml", "utf8"),
  readFile("docs/release/windows-code-signing-final.md", "utf8"),
  readFile("package.json", "utf8"),
]);

const checks = [
  [workflow.includes("workflow_dispatch") && workflow.includes("environment: windows-production-signing") && !workflow.includes("pull_request:"), "protected manual workflow"],
  [workflow.includes("secrets.AZURE_TENANT_ID") && workflow.includes("secrets.AZURE_CLIENT_ID") && workflow.includes("secrets.AZURE_CLIENT_SECRET") && workflow.includes("vars.WINDOWS_PUBLISHER_SUBJECT") && workflow.includes("vars.AZURE_CODE_SIGNING_ENDPOINT") && workflow.includes("vars.AZURE_CODE_SIGNING_ACCOUNT") && workflow.includes("vars.AZURE_CODE_SIGNING_PROFILE"), "CI-only Azure Trusted Signing inputs"],
  [workflow.includes("candidate_commit") && workflow.includes("candidate_version") && workflow.includes("ref: ${{ inputs.candidate_commit }}") && workflow.includes("full 40-character SHA"), "immutable source input"],
  [workflow.includes("actualVersion") && workflow.includes("does not match candidate_version") && workflow.includes("EXPECTED_CANDIDATE_VERSION"), "immutable candidate version check"],
  [workflow.includes("npm run quality:gate") && workflow.includes("npm run package:win") && workflow.includes("Generate post-signing checksum"), "build and post-signing evidence order"],
  [verifier.includes("Get-AuthenticodeSignature") && verifier.includes("Status -ne 'Valid'") && verifier.includes("TimeStamperCertificate") && verifier.includes("Publisher mismatch"), "fail-closed signature verification"],
  [builder.includes("target: nsis") && !/^(?!\s*#)\s*(certificateFile|certificatePassword):/m.test(builder), "unsigned local NSIS remains possible"],
  [docs.includes("NSIS") && docs.includes("MSI") && docs.includes("CI secrets") && docs.includes("Unsigned local builds"), "NSIS and MSI release guidance"],
  [packageText.includes('"windows:signing:smoke"'), "smoke command"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
