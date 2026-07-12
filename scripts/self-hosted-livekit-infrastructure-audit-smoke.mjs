import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const audit = read("docs/self-hosted-livekit-infrastructure-audit.md");
const capacity = read("docs/self-hosted-livekit-capacity-plan.md");
const evidence = JSON.parse(read("docs/evidence/task-658-self-hosted-infrastructure-redacted.json"));
const checkpoint = read("docs/task-checkpoints/task-658-self_hosted_livekit_infrastructure_audit_and_host_prerequisites.md");

for (const marker of ["LOCAL DEVELOPMENT READY", "PUBLIC STAGING AND PRODUCTION BLOCKED", "separate dedicated public Linux VM", "Single-node first", "UNASSIGNED", "does not hide or disable"]) assert.ok(audit.includes(marker), "audit missing " + marker);
for (const marker of ["audio_egress", "screen_egress", "planned_egress", "4 dedicated vCPU", "8 dedicated vCPU", "Task 671", "Task 672", "50% measured headroom"]) assert.ok(capacity.includes(marker), "capacity plan missing " + marker);
assert.equal(evidence.containsSecrets, false);
assert.equal(evidence.containsPublicIp, false);
assert.equal(evidence.containsPrivateHostDetails, false);
assert.equal(evidence.localDevelopment.dockerLinuxEngineReady, true);
assert.equal(evidence.externalInfrastructure.dedicatedStagingLinuxHostVerified, false);
assert.equal(evidence.externalInfrastructure.dedicatedProductionLinuxHostVerified, false);
assert.equal(evidence.decision.productVoiceVisibility, "in_v1_visible");
assert.ok(!JSON.stringify(evidence).match(/(?:\d{1,3}\.){3}\d{1,3}/), "redacted evidence must not contain an IP address");
assert.ok(checkpoint.includes("PARTIAL PASS") && checkpoint.includes("Voice remains IN_V1"));
console.log("Task 658 self-hosted infrastructure audit, capacity, redaction, and Voice visibility contract passed.");
