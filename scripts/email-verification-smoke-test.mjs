import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authService = readFileSync("src/services/authService.ts", "utf8");
const settingsModal = readFileSync("src/components/SettingsModal.tsx", "utf8");

assert.match(authService, /requestEmailVerification/);
assert.match(authService, /confirmEmailVerification/);
assert.match(authService, /exchangeCodeForSession/);
assert.match(authService, /emailVerifiedAt/);
assert.match(authService, /If verification is available/);
assert.doesNotMatch(authService, /verificationTokenPreview/);

assert.match(settingsModal, /Email verification/);
assert.match(settingsModal, /Resend verification/);
assert.match(settingsModal, /Verification required/);

console.log("OK email verification production smoke test completed");
