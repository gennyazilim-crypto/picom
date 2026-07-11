import { access, readFile } from "node:fs/promises";

const valueAfter = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const matrixPath = "tests/e2e/full-mvp-staging-matrix.json";
const evidencePath = valueAfter("--evidence") ?? "docs/evidence/task-519-full-mvp-staging-e2e.json";
const requirePass = process.argv.includes("--require-pass");
const [matrix, evidence, packageJson] = await Promise.all([
  readFile(matrixPath, "utf8").then(JSON.parse),
  readFile(evidencePath, "utf8").then(JSON.parse),
  readFile("package.json", "utf8").then(JSON.parse),
]);

const requiredFlowIds = [
  "first-launch-auth-onboarding",
  "community-kinds-create",
  "invite-join-visitor-member",
  "roles-permissions",
  "text-chat-message-lifecycle",
  "text-chat-attachments",
  "friends-direct-messages",
  "profile-settings-privacy-verification",
  "feed-cross-content-mentions",
  "radio-listener-host",
  "podcast-publish-listen",
  "settings-persistence",
  "voice-two-client",
  "screen-share-native",
  "moderation-audit",
  "logout-session-restore",
  "realtime-reconnect-dedup",
  "private-data-isolation",
];
const requiredActors = ["new_user", "owner", "admin", "moderator", "member", "visitor", "blocked_user", "dm_non_participant"];
const allowedStatuses = new Set(["PASS", "FAIL", "BLOCKED"]);
const failures = [];

const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check(matrix.schemaVersion === 1, "matrix schemaVersion must be 1");
check(matrix.target === "staging", "matrix target must be staging");
check(matrix.productionAllowed === false, "production targeting must be disabled");
check(JSON.stringify(matrix.desktopPlatforms) === JSON.stringify(["windows", "linux", "macos"]), "desktop platform order must be windows, linux, macos");
for (const actor of requiredActors) check(matrix.requiredActors?.includes(actor), `missing required actor: ${actor}`);
check(matrix.requiredConfirmations?.includes("STAGING_ONLY"), "STAGING_ONLY confirmation is required");
check(matrix.requiredConfirmations?.includes("ALLOW_SYNTHETIC_WRITES"), "synthetic write confirmation is required");

const flows = Array.isArray(matrix.flows) ? matrix.flows : [];
const flowIds = flows.map((flow) => flow.id);
check(new Set(flowIds).size === flowIds.length, "flow ids must be unique");
for (const id of requiredFlowIds) check(flowIds.includes(id), `missing Full MVP staging flow: ${id}`);
for (const flow of flows) {
  check(Array.isArray(flow.actors) && flow.actors.length > 0, `${flow.id} needs actors`);
  check(Array.isArray(flow.checks) && flow.checks.length > 0, `${flow.id} needs checks`);
  check(Array.isArray(flow.evidence) && flow.evidence.length > 0, `${flow.id} needs evidence requirements`);
  check(Array.isArray(flow.preflightCommands) && flow.preflightCommands.length > 0, `${flow.id} needs deterministic preflight commands`);
  for (const command of flow.preflightCommands ?? []) {
    check(typeof packageJson.scripts?.[command] === "string", `${flow.id} references missing npm command: ${command}`);
  }
}

for (const suite of matrix.hostedSuites ?? []) {
  check(typeof suite.id === "string" && typeof suite.runner === "string", "hosted suite needs id and runner");
  if (typeof suite.runner === "string") {
    try { await access(suite.runner); } catch { failures.push(`hosted suite runner does not exist: ${suite.runner}`); }
  }
}

const forbiddenKey = /password|secret|access.?token|refresh.?token|service.?role|private.?key|connection.?string|credential/i;
const inspectKeys = (value, path = "evidence") => {
  if (Array.isArray(value)) return value.forEach((item, index) => inspectKeys(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKey.test(key)) failures.push(`${path}.${key} is forbidden in redacted evidence`);
    inspectKeys(child, `${path}.${key}`);
  }
};
inspectKeys(evidence);

check(evidence.schemaVersion === 1, "evidence schemaVersion must be 1");
check(evidence.task === 519, "evidence must identify Task 519");
check(evidence.target === "staging", "evidence target must be staging");
check(evidence.productionUsed === false, "evidence must state production was not used");
check(evidence.redactionReviewed === true, "evidence must be marked redaction reviewed");
check(allowedStatuses.has(evidence.executionStatus), "evidence executionStatus must be PASS, FAIL, or BLOCKED");

const results = Array.isArray(evidence.flowResults) ? evidence.flowResults : [];
const resultIds = results.map((result) => result.id);
check(new Set(resultIds).size === resultIds.length, "evidence flow result ids must be unique");
for (const id of requiredFlowIds) check(resultIds.includes(id), `evidence missing flow result: ${id}`);
for (const result of results) {
  check(allowedStatuses.has(result.status), `${result.id} has invalid status`);
  check(typeof result.reasonCode === "string" && result.reasonCode.length > 0, `${result.id} needs a redacted reasonCode`);
}

if (requirePass) {
  check(evidence.executionStatus === "PASS", "full hosted execution cannot pass while evidence is not PASS");
  for (const result of results) check(result.status === "PASS", `${result.id} is not PASS`);
  for (const provider of Object.values(evidence.providerResults ?? {})) check(provider === "PASS", "all required provider results must be PASS");
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

const counts = results.reduce((summary, result) => {
  summary[result.status] = (summary[result.status] ?? 0) + 1;
  return summary;
}, {});
console.log(`PASS: Full MVP staging matrix contract covers ${flows.length} flows and ${matrix.hostedSuites.length} protected hosted suites.`);
console.log(`EVIDENCE: PASS=${counts.PASS ?? 0} FAIL=${counts.FAIL ?? 0} BLOCKED=${counts.BLOCKED ?? 0}; execution=${evidence.executionStatus}.`);
if (evidence.executionStatus !== "PASS") console.log("BLOCKED: this contract result is not real staging certification.");
