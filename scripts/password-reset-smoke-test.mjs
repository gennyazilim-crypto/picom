import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authService = readFileSync("src/services/authService.ts", "utf8");
const loginScreen = readFileSync("src/components/LoginScreen.tsx", "utf8");
const recoveryScreen = readFileSync("src/components/auth/ForgotPasswordScreen.tsx", "utf8");
const resetPage = readFileSync("src/account/pages/ResetPasswordPage.tsx", "utf8");

assert.match(authService, /requestPasswordReset/);
assert.match(authService, /preparePasswordRecovery/);
assert.match(authService, /confirmPasswordReset/);
assert.match(authService, /resetPasswordForEmail/);
assert.match(authService, /exchangeCodeForSession/);
assert.match(authService, /updateUser/);
assert.match(authService, /If an account exists/);
assert.doesNotMatch(authService, /account exists for \$\{/);

assert.match(loginScreen, /onForgotPassword/);
assert.doesNotMatch(loginScreen, /No account found/i);

assert.match(recoveryScreen, /requestPasswordReset/);
assert.match(recoveryScreen, /recovery\.success/);
assert.doesNotMatch(recoveryScreen, /No account found/i);

assert.match(resetPage, /New password|newPassword|confirmPassword|updateUser|confirmPasswordReset/i);

console.log("OK password reset production smoke test completed");
