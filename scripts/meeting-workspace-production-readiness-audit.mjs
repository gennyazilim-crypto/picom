import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

const requireCondition = (condition, message) => {
  if (!condition) failures.push(message);
};

const readJson = (relativePath) =>
  JSON.parse(readFileSync(join(root, relativePath), "utf8"));

const expectedCommitSubjects = new Map([
  [528, "docs audit meeting workspace current state"],
  [529, "docs lock meeting workspace full mvp scope"],
  [530, "feat add canonical meeting domain model"],
  [531, "feat add supabase meeting schema"],
  [532, "security enforce meeting rls permissions"],
  [533, "feat integrate meeting room creation"],
  [534, "feat add meeting schedules invites backend"],
  [535, "feat deploy secure meeting token service"],
  [536, "feat sync meeting state from livekit webhooks"],
  [537, "feat add meeting waiting room backend"],
  [538, "feat reconcile meeting participant state"],
  [539, "feat link meeting chat to Picom messaging"],
  [540, "feat add meeting reactions hand signaling"],
  [541, "feat integrate meeting notifications reminders"],
  [542, "feat add meeting client state machine"],
  [543, "feat build Picom meeting workspace shell"],
  [544, "feat complete meeting prejoin"],
  [545, "feat complete meeting device previews"],
  [546, "feat build voice lounge layout"],
  [547, "feat add adaptive meeting video grid"],
  [548, "feat add speaker focus filmstrip"],
  [549, "feat add screen share focus layout"],
  [550, "feat add stage audience meeting mode"],
  [551, "feat add participant tile state contract"],
  [552, "feat complete meeting control dock"],
  [553, "feat build meeting right dock"],
  [554, "feat complete meeting waiting room ui"],
  [555, "feat complete meeting invite experience"],
  [556, "feat add meeting participant context menu"],
  [557, "feat complete meeting host moderation controls"],
  [558, "feat complete meeting reactions raise hand ui"],
  [559, "feat add meeting layouts pinning focus mode"],
  [560, "feat integrate mini meeting across Picom"],
  [561, "feat integrate noise shield meeting workspace"],
  [562, "perf add adaptive meeting media quality"],
  [563, "feat complete production screen share pipeline"],
  [564, "fix meeting device permission recovery"],
  [565, "fix meeting reconnect cleanup"],
  [566, "feat complete meeting chat ui"],
  [567, "feat add secure live captions transcript"],
  [568, "feat add meeting history attendance"],
  [569, "security add meeting privacy consent audit"],
  [570, "security harden meeting abuse controls"],
  [571, "ops add meeting diagnostics observability"],
  [572, "fix meeting accessibility keyboard"],
  [573, "perf enforce meeting performance budgets"],
  [574, "test add meeting contract suite"],
  [575, "test hosted two client meeting e2e"],
  [576, "test meeting multi participant capacity"],
  [577, "test final hosted meeting backend validation"],
  [578, "test certify Windows meeting workspace"],
  [579, "test certify Linux meeting workspace"],
  [580, "test certify macOS meeting workspace"],
  [581, "security gate meeting workspace"],
]);

const checkpointDir = join(root, "docs", "task-checkpoints");
const checkpointTasks = new Set(
  readdirSync(checkpointDir)
    .map((name) => name.match(/^task-(\d+)-/))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .filter((task) => task >= 528 && task <= 581),
);

for (let task = 528; task <= 581; task += 1) {
  requireCondition(checkpointTasks.has(task), `Missing checkpoint for Task ${task}.`);
}
requireCondition(checkpointTasks.size === 54, `Expected 54 checkpoints, found ${checkpointTasks.size}.`);

const gitSubjects = new Set(
  execFileSync("git", ["log", "--format=%s"], { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean),
);
for (const [task, subject] of expectedCommitSubjects) {
  requireCondition(gitSubjects.has(subject), `Missing exact Task ${task} commit subject: ${subject}`);
}
requireCondition(
  gitSubjects.has("fix preserve server meeting reactions"),
  "Missing corrective meeting reaction preservation commit.",
);

const requiredImplementation = {
  domain: "src/types/meeting.ts",
  clientState: "src/stores/meetingStore.ts",
  repository: "src/services/meeting/meetingRepository.ts",
  service: "src/services/meeting/meetingService.ts",
  workspace: "src/components/meeting/MeetingWorkspace.tsx",
  voiceLounge: "src/components/meeting/MeetingVoiceLounge.tsx",
  videoGrid: "src/components/meeting/MeetingVideoGrid.tsx",
  speakerFocus: "src/components/meeting/MeetingSpeakerFocus.tsx",
  screenShareFocus: "src/components/meeting/MeetingScreenShareFocus.tsx",
  stageAudience: "src/components/meeting/MeetingStageAudience.tsx",
  preJoin: "src/components/meeting/MeetingPreJoin.tsx",
  waitingRoom: "src/components/meeting/MeetingWaitingRoomHostQueue.tsx",
  controlDock: "src/components/meeting/MeetingControlDock.tsx",
  rightDock: "src/components/meeting/MeetingRightDock.tsx",
  chat: "src/components/meeting/MeetingChatPanel.tsx",
  reactions: "src/components/meeting/MeetingReactionOverlay.tsx",
  moderation: "src/services/meeting/meetingParticipantModerationService.ts",
  miniMeeting: "src/components/meeting/ConnectedMeetingMiniCard.tsx",
  noiseShield: "src/services/noiseShieldService.ts",
  captions: "src/components/meeting/MeetingCaptionPanel.tsx",
  captionService: "src/services/meeting/meetingCaptionService.ts",
  history: "src/components/meeting/MeetingHistoryPanel.tsx",
  notifications: "src/services/meeting/meetingNotificationService.ts",
  diagnostics: "src/services/meetingDiagnosticsRegistry.ts",
  tokenFunction: "supabase/functions/meeting-token/index.ts",
  captionsFunction: "supabase/functions/meeting-captions/index.ts",
  contractSuite: "scripts/meeting-contract-suite.mjs",
  securityGate: "scripts/meeting-security-privacy-rls-final-gate.mjs",
};

for (const [feature, relativePath] of Object.entries(requiredImplementation)) {
  requireCondition(existsSync(join(root, relativePath)), `Missing ${feature} implementation: ${relativePath}`);
}

const meetingMigrations = readdirSync(join(root, "supabase", "migrations")).filter((name) =>
  name.includes("meeting"),
);
requireCondition(meetingMigrations.length >= 19, `Expected at least 19 meeting migrations, found ${meetingMigrations.length}.`);

for (let task = 575; task <= 580; task += 1) {
  const evidenceName = readdirSync(join(root, "docs", "evidence")).find((name) =>
    name.startsWith(`task-${task}-`),
  );
  requireCondition(Boolean(evidenceName), `Missing Task ${task} evidence.`);
  if (evidenceName) {
    const evidence = readJson(join("docs", "evidence", evidenceName));
    requireCondition(
      evidence.executionStatus === "BLOCKED",
      `Task ${task} external execution must remain BLOCKED without real evidence.`,
    );
  }
}

const securityEvidence = readJson("docs/evidence/task-581-meeting-security-gate.json");
requireCondition(securityEvidence.localGateStatus === "PASS", "Task 581 local security gate is not PASS.");
requireCondition(securityEvidence.hostedGateStatus === "BLOCKED", "Task 581 hosted gate must remain BLOCKED.");
requireCondition(securityEvidence.nativeIndicatorStatus === "BLOCKED", "Task 581 native gate must remain BLOCKED.");
requireCondition(securityEvidence.stableDecision === "NO_GO", "Task 581 stable decision must remain NO_GO.");

const finalEvidence = readJson("docs/evidence/task-582-meeting-production-readiness.json");
requireCondition(finalEvidence.decisions.fullMvpCode === "COMPLETE", "Task 582 code decision must be COMPLETE.");
requireCondition(finalEvidence.decisions.hostedBackend === "BLOCKED", "Hosted backend must remain BLOCKED.");
requireCondition(finalEvidence.decisions.windows === "BLOCKED", "Windows certification must remain BLOCKED.");
requireCondition(finalEvidence.decisions.linux === "BLOCKED", "Linux certification must remain BLOCKED.");
requireCondition(finalEvidence.decisions.macos === "BLOCKED", "macOS certification must remain BLOCKED.");
requireCondition(finalEvidence.decisions.stableRelease === "NO_GO", "Stable release must remain NO_GO.");

const logoTracked =
  spawnSync("git", ["cat-file", "-e", "HEAD:assets/brand/picom-logo.png"], {
    cwd: root,
    stdio: "ignore",
  }).status === 0;
if (!logoTracked) {
  requireCondition(
    finalEvidence.cleanCheckoutBuild.status === "BLOCKED",
    "The missing tracked Picom logo must be recorded as a clean-checkout build blocker.",
  );
}

const sourcePaths = [
  join(root, "src", "components", "meeting"),
  join(root, "src", "services", "meeting"),
];
const forbiddenAcceptanceText = /coming soon|placeholder action|raw placeholder|console\.(?:log|info)\s*\(/i;
for (const directory of sourcePaths) {
  for (const name of readdirSync(directory)) {
    if (!/\.(?:ts|tsx)$/.test(name)) continue;
    const content = readFileSync(join(directory, name), "utf8");
    requireCondition(
      !forbiddenAcceptanceText.test(content),
      `Acceptance-path placeholder/debug text found in ${name}.`,
    );
  }
}

if (failures.length) {
  console.error("Task 582 meeting workspace readiness audit FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Task 582 meeting workspace readiness audit PASS.");
console.log(`Traceability: ${checkpointTasks.size}/54 checkpoints; ${expectedCommitSubjects.size}/54 exact task commits.`);
console.log(`Implementation inventory: ${Object.keys(requiredImplementation).length}/${Object.keys(requiredImplementation).length} required paths.`);
console.log(`Meeting migrations: ${meetingMigrations.length}.`);
console.log("Decision: code COMPLETE; hosted BLOCKED; Windows/Linux/macOS BLOCKED; stable NO_GO.");
if (!logoTracked) console.log("Release-candidate warning: tracked Picom brand logo is missing; clean-checkout build remains BLOCKED.");
