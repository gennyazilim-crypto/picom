import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suites = [
  ["domain-schema", [
    "meeting-domain-model-smoke.mjs",
    "meeting-schema-foundation-smoke.mjs",
    "meeting-room-admin-integration-smoke.mjs",
  ]],
  ["permissions-security", [
    "meeting-rls-permission-smoke.mjs",
    "livekit-meeting-token-security-smoke.mjs",
    "livekit-webhook-security-smoke.mjs",
    "meeting-abuse-prevention-smoke.mjs",
    "meeting-privacy-consent-audit-smoke.mjs",
  ]],
  ["join-waiting-invites-notifications", [
    "meeting-schedules-invites-join-policy-smoke.mjs",
    "meeting-invite-experience-smoke.mjs",
    "meeting-waiting-room-backend-smoke.mjs",
    "meeting-waiting-room-ui-full-mvp-smoke.mjs",
    "meeting-notifications-reminders-smoke.mjs",
  ]],
  ["state-realtime-moderation", [
    "meeting-client-state-machine-smoke.mjs",
    "meeting-participant-reconciliation-smoke.mjs",
    "meeting-reactions-hand-signaling-smoke.mjs",
    "meeting-reactions-raise-hand-ui-smoke.mjs",
    "meeting-host-controls-smoke.mjs",
    "meeting-history-attendance-smoke.mjs",
  ]],
  ["media-device-screen-share-ipc", [
    "meeting-prejoin-full-mvp-smoke.mjs",
    "meeting-control-dock-full-mvp-smoke.mjs",
    "meeting-device-previews-smoke.mjs",
    "meeting-device-permission-recovery-smoke.mjs",
    "meeting-adaptive-media-quality-smoke.mjs",
    "meeting-adaptive-video-grid-smoke.mjs",
    "meeting-production-screen-share-smoke.mjs",
    "meeting-screen-share-focus-smoke.mjs",
    "screen-share-picker-bridge-full-mvp-smoke.mjs",
    "ipc-invalid-payload-fuzz-test.mjs",
    "meeting-reconnect-cleanup-smoke.mjs",
    "meeting-participant-tile-contract-smoke.mjs",
    "meeting-runtime-budget-smoke.mjs",
  ]],
  ["layouts-controls-workspace", [
    "meeting-workspace-shell-smoke.mjs",
    "meeting-voice-lounge-layout-smoke.mjs",
    "meeting-speaker-focus-filmstrip-smoke.mjs",
    "meeting-stage-audience-full-mvp-smoke.mjs",
    "meeting-layout-pinning-focus-smoke.mjs",
    "meeting-right-dock-full-mvp-smoke.mjs",
  ]],
  ["chat-captions-accessibility-observability", [
    "meeting-chat-picom-messaging-smoke.mjs",
    "meeting-chat-ui-full-mvp-smoke.mjs",
    "meeting-captions-full-mvp-smoke.mjs",
    "meeting-accessibility-keyboard-smoke.mjs",
    "meeting-observability-diagnostics-smoke.mjs",
    "noise-shield-meeting-integration-smoke.mjs",
  ]],
];

const secretNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "LIVEKIT_API_SECRET",
  "LIVEKIT_API_KEY",
  "APPLE_ID_PASSWORD",
  "CSC_KEY_PASSWORD",
  "GH_TOKEN",
];
const childEnvironment = { ...process.env, CI: "true", PICOM_DATA_SOURCE: "mock", VITE_DATA_SOURCE: "mock" };
for (const name of secretNames) delete childEnvironment[name];

const allScripts = suites.flatMap(([, scripts]) => scripts);
if (new Set(allScripts).size !== allScripts.length) throw new Error("Meeting contract suite contains a duplicate test command.");
for (const script of allScripts) {
  if (/(?:^|[-_.])(staging|hosted|native|package|signing|notarization)(?:[-_.]|$)/i.test(script)) throw new Error(`External evidence script is forbidden in deterministic suite: ${script}`);
}

const results = [];
console.log(`Picom deterministic meeting contract suite: ${allScripts.length} contracts across ${suites.length} groups.`);
for (const [group, scripts] of suites) {
  console.log(`\n=== ${group} ===`);
  for (const script of scripts) {
    const absolute = path.join(root, "scripts", script);
    const started = performance.now();
    const result = spawnSync(process.execPath, [absolute], {
      cwd: root,
      env: childEnvironment,
      encoding: "utf8",
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const durationMs = Math.round(performance.now() - started);
    const passed = result.status === 0 && !result.error;
    results.push({ group, script, passed, durationMs, exitCode: result.status, signal: result.signal ?? null });
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    if (output) console.log(output);
    console.log(`${passed ? "PASS" : "FAIL"} ${script} (${durationMs} ms)`);
    if (result.error) console.error(result.error.message);
  }
}

const failures = results.filter((result) => !result.passed);
console.log("\n=== meeting contract summary ===");
for (const group of suites.map(([name]) => name)) {
  const grouped = results.filter((result) => result.group === group);
  console.log(`${group}: ${grouped.filter((result) => result.passed).length}/${grouped.length} passed`);
}
console.log("Evidence class: deterministic mock, source contract, and local SQL contract only. No hosted/provider/native pass is claimed.");
if (failures.length) {
  console.error(`Meeting contract suite failed (${failures.length}/${results.length}): ${failures.map((result) => result.script).join(", ")}`);
  process.exit(1);
}
console.log(`Meeting contract suite passed (${results.length}/${results.length}).`);
