import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authService = readFileSync("src/services/authService.ts", "utf8");
const loginScreen = readFileSync("src/components/LoginScreen.tsx", "utf8");

assert.match(authService, /requestPasswordReset/);
assert.match(authService, /confirmPasswordResetPlaceholder/);
assert.match(authService, /resetPasswordForEmail/);
assert.match(authService, /If an account exists/);
assert.doesNotMatch(authService, /account exists for \$\{/);

assert.match(loginScreen, /Forgot password\?/);
assert.match(loginScreen, /Password reset placeholder/);
assert.match(loginScreen, /whether an account exists or not/);
assert.doesNotMatch(loginScreen, /No account found/i);

console.log("OK password reset placeholder smoke test completed");
