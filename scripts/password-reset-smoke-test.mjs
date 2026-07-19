import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const authService = readFileSync("src/services/authService.ts", "utf8");
const loginScreen = readFileSync("src/components/LoginScreen.tsx", "utf8");

assert.match(authService, /requestPasswordReset/);
assert.match(authService, /preparePasswordRecovery/);
assert.match(authService, /confirmPasswordReset/);
assert.match(authService, /resetPasswordForEmail/);
assert.match(authService, /exchangeCodeForSession/);
assert.match(authService, /updateUser/);
assert.match(authService, /If an account exists/);
assert.doesNotMatch(authService, /account exists for \$\{/);

assert.match(loginScreen, /Forgot password\?/);
assert.match(loginScreen, /Reset your password/);
assert.match(loginScreen, /whether an account exists or not/);
assert.doesNotMatch(loginScreen, /No account found/i);

// Recovery success/error styling must come from the returned `ok` flag, not brittle
// string-matching on the message text (which breaks on any wording/localization change).
assert.match(loginScreen, /setRecoverySucceeded\(result\.ok\)/);
assert.doesNotMatch(loginScreen, /startsWith\("Password updated"\)/);

console.log("OK password reset production smoke test completed");
