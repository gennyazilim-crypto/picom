import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authService = readFileSync("src/services/authService.ts", "utf8");
const settingsModal = readFileSync("src/components/SettingsModal.tsx", "utf8");

assert.match(authService, /requestEmailVerification/);
assert.match(authService, /confirmEmailVerificationPlaceholder/);
assert.match(authService, /emailVerifiedAt/);
assert.match(authService, /If verification is available/);
assert.doesNotMatch(authService, /verificationTokenPreview/);

assert.match(settingsModal, /Email verification/);
assert.match(settingsModal, /Resend verification placeholder/);
assert.match(settingsModal, /not required for MVP login/);

console.log("OK email verification placeholder smoke test completed");
