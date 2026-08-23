import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authService = readFileSync("src/services/authService.ts", "utf8");
const settingsModal = readFileSync("src/components/SettingsModal.tsx", "utf8");
const accountSummary = readFileSync("src/components/settings/AccountSummarySection.tsx", "utf8");
const settingsI18n = readFileSync("src/services/settings/settingsI18n.ts", "utf8");

assert.match(authService, /requestEmailVerification/);
assert.match(authService, /confirmEmailVerification/);
assert.match(authService, /exchangeCodeForSession/);
assert.match(authService, /emailVerifiedAt/);
assert.match(authService, /If verification is available/);
assert.doesNotMatch(authService, /verificationTokenPreview/);

assert.match(settingsModal, /requestEmailVerification/);
assert.match(settingsI18n, /"account.emailPending": "Email verification pending"/);
assert.match(settingsI18n, /"account.emailVerified": "Verified · \{when\}"/);
assert.match(accountSummary, /account\.emailPending/);
assert.match(accountSummary, /account\.emailVerified/);
assert.match(accountSummary, /accountCenterUrls\.email/);

console.log("OK email verification production smoke test completed");
