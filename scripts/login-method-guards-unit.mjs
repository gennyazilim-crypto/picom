import assert from "node:assert/strict";

const { canUnlinkProvider, countUsableLoginMethods } = await import(
  "../src/services/auth/loginMethodGuards.ts"
);

assert.equal(countUsableLoginMethods({ hasPassword: true, linkedProviders: [] }), 1);
assert.equal(countUsableLoginMethods({ hasPassword: false, linkedProviders: ["google"] }), 1);
assert.equal(countUsableLoginMethods({ hasPassword: true, linkedProviders: ["steam", "epic"] }), 3);
assert.equal(countUsableLoginMethods({ hasPassword: false, linkedProviders: ["email", ""] }), 0);

assert.equal(canUnlinkProvider({ hasPassword: true, linkedProviders: ["steam"] }, "steam").ok, true);
assert.equal(canUnlinkProvider({ hasPassword: false, linkedProviders: ["steam"] }, "steam").ok, false);
assert.deepEqual(canUnlinkProvider({ hasPassword: false, linkedProviders: ["steam"] }, "steam"), {
  ok: false,
  reason: "last_method",
});
assert.deepEqual(canUnlinkProvider({ hasPassword: true, linkedProviders: ["google"] }, "steam"), {
  ok: false,
  reason: "not_linked",
});
assert.equal(
  canUnlinkProvider({ hasPassword: false, linkedProviders: ["google", "steam"] }, "steam").ok,
  true,
);

console.log("login-method-guards unit tests passed");
