import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [license, config, legalDocuments, legalGate, ownershipGate, blockers, packageJson] = await Promise.all([
  read("LICENSE"),
  read("src/config/legalConfig.ts"),
  read("src/data/legalDocuments.ts"),
  read("docs/v1-legal-approval.md"),
  read("docs/v1-production-ownership.md"),
  read("docs/release-blockers.md"),
  read("package.json"),
]);

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

assert(/placeholder/i.test(license), "Root LICENSE must remain visibly placeholder until authorized approval");
assert(/requiresProfessionalReview:\s*true/.test(config), "Professional legal review guard must remain enabled");
assert(/beta-/.test(config), "Unapproved legal versions must remain beta-labelled");
assert(/LiveKit/.test(legalDocuments) && /microphone audio/.test(legalDocuments) && /selected screen or window/.test(legalDocuments), "V1 legal drafts must disclose included Voice/Screen transport");
assert(/does not record or store raw microphone audio or shared-screen frames/.test(legalDocuments), "V1 legal drafts must preserve the no-raw-media-storage boundary");
assert(!/radio|podcast|meeting|artificial intelligence/i.test(legalDocuments), "V1 runtime legal drafts must not claim post-V1 product processing");
assert(/BLOCKED \/ NO-GO/.test(legalGate), "V1 legal gate must remain explicitly blocked without approval evidence");
assert(/UNASSIGNED/.test(ownershipGate) && /BLOCKED \/ NO-GO/.test(ownershipGate), "V1 ownership gate must preserve missing assignments truthfully");
assert(/RB-09[\s\S]*RB-10/.test(blockers) && /Task 623 final legal approval and production ownership/.test(blockers), "Release blocker register must include the Task 623 decision");

const { version } = JSON.parse(packageJson);
const releaseBlockers = [
  "authorized immutable legal/license approval is missing",
  "production accountable and recovery owners are unassigned",
  ...(version === "1.0.0" ? [] : [`package version is ${version}, not 1.0.0`]),
];

if (failures.length > 0) {
  for (const failure of failures) console.error(`[FAIL] ${failure}`);
  process.exitCode = 1;
} else {
  console.log("[PASS] V1 legal and ownership truthfulness safeguards are intact.");
  console.log(`[V1 RELEASE] BLOCKED: ${releaseBlockers.join("; ")}.`);
}
