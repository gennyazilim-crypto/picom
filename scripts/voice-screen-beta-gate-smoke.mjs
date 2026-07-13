import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const scope = readFileSync("src/config/v1ReleaseScope.ts", "utf8");
const clientConfig = readFileSync("supabase/functions/client-config/index.ts", "utf8");
const flags = readFileSync("src/services/featureFlagService.ts", "utf8");
const killSwitches = readFileSync("src/services/emergencyKillSwitchService.ts", "utf8");

assert.equal(existsSync("src/config/betaFeatureOverrides.ts"), false, "Voice/Screen product scope must not depend on a beta override");
assert.ok(!scope.includes("isBetaFeatureUnlocked"), "V1 scope must not use a runtime beta unlock");
for (const feature of ["voiceRooms", "screenShare"]) assert.match(scope, new RegExp(`${feature}: inV1\\(`), `${feature} must be IN_V1`);
assert.ok(clientConfig.includes("enableVoiceRooms: true") && clientConfig.includes("enableScreenShare: true"), "remote defaults must keep Voice/Screen enabled");
assert.ok(flags.includes("enableVoiceRooms: true") && flags.includes("enableScreenShare: true"), "renderer defaults must keep Voice/Screen enabled");
assert.ok(killSwitches.includes('disableVoiceRooms: false'), "emergency fail-safe kill switch must remain available and default off");
console.log("Voice + Screen Share V1 gate contract passed: always in product scope; emergency kill switch remains separate.");
