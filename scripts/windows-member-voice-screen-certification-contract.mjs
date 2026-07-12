import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const workflow = read(".github/workflows/windows-member-voice-screen-certification.yml");
const main = read("electron/main.cts");
const build = read("scripts/build-electron.mjs");
const harnessMain = read("scripts/fixtures/livekit-hosted-e2e/main.cjs");
const renderer = read("scripts/fixtures/livekit-hosted-e2e/renderer.ts");
const orchestrator = read("scripts/hosted-member-voice-screen-e2e.mjs");
const certifier = read("scripts/windows-member-voice-screen-certification.mjs");
const scope = read("src/config/v1ReleaseScope.ts");

for (const marker of ["workflow_dispatch", "runs-on: windows-latest", "environment: hosted-staging", "npm run package:win", "voice:screen:windows:certify", "task-666-packaged-windows-member-voice-screen-evidence"]) assert.ok(workflow.includes(marker), `Windows certification workflow missing ${marker}`);
assert.ok(!workflow.includes("continue-on-error") && !workflow.includes("service-role") && !workflow.includes("--no-sandbox"), "Windows certification must fail closed without requesting raw provider secrets or disabling sandboxing");
for (const marker of ["app.isPackaged", "process.platform === \"win32\"", "CONTROLLED_WINDOWS_ONLY", "PICOM_HOSTED_E2E_CONFIG_FD", "PICOM_WINDOWS_MEMBER_MEDIA_CERT_PACKAGE_SHA", "certification", "main.cjs"]) assert.ok(main.includes(marker), `packaged Electron certification gate missing ${marker}`);
assert.ok(build.includes("PICOM_BUILD_WINDOWS_MEMBER_MEDIA_CERTIFICATION") && build.includes("rm(certificationOutputDirectory") && build.includes("livekit-hosted-e2e"), "certification runtime must be opt-in and removed from ordinary builds");
for (const marker of ["desktopCapturer.getSources", 'types: ["screen", "window"]', "Picom Certification Share Target", "setPermissionRequestHandler", "screen-restart"]) assert.ok(harnessMain.includes(marker), `native harness main missing ${marker}`);
for (const marker of ["navigator.mediaDevices.getUserMedia", 'chromeMediaSource: "desktop"', "pickerCancelPassed", "windowSourceCount", "restartScreen", 'readyState === "ended"']) assert.ok(renderer.includes(marker), `native renderer proof missing ${marker}`);
assert.ok(orchestrator.includes("PICOM_HOSTED_E2E_EXECUTABLE") && orchestrator.includes("rolelessMemberPassed") && orchestrator.includes("nativeWindowCapturePassed"), "hosted orchestrator must bind member/RLS proof to the packaged executable");
for (const marker of ["createHash", "installerSha256", "normalRestartPassed", "physicalMicrophoneNotClaimed", "trustedSigningNotClaimed", "containsSecrets: false"]) assert.ok(certifier.includes(marker), `certifier evidence contract missing ${marker}`);
assert.match(scope, /voiceRooms:\s*hidden\(/, "Task 666 must not include Voice before Task 668");
assert.match(scope, /screenShare:\s*hidden\(/, "Task 666 must not include Screen Share before Task 668");

console.log("Packaged Windows member Voice/Screen certification contract passed without native capture or network access.");
