import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const workflow = read(".github/workflows/windows-signed-release.yml");
const verifier = read("scripts/verify-windows-signature.ps1");
const builder = read("electron-builder.yml");
const pkg = JSON.parse(read("package.json"));
const evidence = read("docs/v1-windows-signed-clean-machine.md");

assert.ok(workflow.includes("environment: windows-production-signing") && workflow.includes("candidate_commit") && workflow.includes("candidate_version"), "protected environment and frozen candidate inputs are required");
assert.ok(workflow.includes("ref: ${{ inputs.candidate_commit }}") && workflow.includes("^[0-9a-fA-F]{40}$"), "workflow must check out and validate a full SHA");
assert.ok(workflow.includes("must be exactly 1.0.0") && workflow.includes("VITE_RELEASE_CHANNEL: stable"), "workflow must freeze V1 version and channel");
assert.ok(!workflow.includes("continue-on-error"), "signing failures must remain blocking");
const signatureStep = workflow.indexOf("Verify installer signature, publisher and timestamp");
const checksumStep = workflow.indexOf("Generate post-signing checksum and provenance");
assert.ok(signatureStep > 0 && checksumStep > signatureStep, "signature/publisher/timestamp verification must precede checksums");
assert.ok(verifier.includes("Get-AuthenticodeSignature") && verifier.includes("TimeStamperCertificate") && verifier.includes("Publisher mismatch"), "signature verifier must fail closed");
assert.ok(builder.includes("deleteAppDataOnUninstall: false") && !/^(?!\s*#)\s*(certificateFile|certificatePassword):/m.test(builder), "retention policy must be explicit and credentials must not be committed");
assert.ok(evidence.includes("Status: **BLOCKED**") && evidence.includes("No SHA-256 is recorded"), "missing external evidence must remain explicit");
console.log("Windows signing and clean-machine guard contract passed.");
console.log(pkg.version === "1.0.0" ? "Candidate version is ready for the protected workflow." : `BLOCKED: package version is ${pkg.version}; protected workflow requires 1.0.0.`);
