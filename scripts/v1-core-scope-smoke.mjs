import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const scope = read("src/config/v1ReleaseScope.ts");
const appConfig = read("src/config/appConfig.ts");
const navigation = read("src/services/navigation/globalNavigationRegistry.ts");
const serverRail = read("src/components/ServerRail.tsx");
const helpNavigation = read("src/services/navigation/helpSupportNavigationService.ts");
const settings = read("src/services/settingsService.ts");
const app = read("src/App.tsx");
const scopeDoc = read("docs/v1-core-scope-freeze.md");
const gateDoc = read("docs/v1-feature-gate-contract.md");

assert(scope.includes('version: "1.0.0"'), "V1 scope must declare version 1.0.0.");
assert(scope.includes('supportedPlatforms: Object.freeze(["windows"] as const)'), "V1 stable platform claim must be Windows-only.");
for (const key of ["feed", "textCommunities", "textMessaging", "directMessages", "profile", "userSettings", "communityAdmin"]) {
  assert(new RegExp(`${key}: inV1\\(`).test(scope), `${key} must be classified IN_V1.`);
}
for (const key of ["voiceRooms", "screenShare", "radio", "podcasts", "events", "bookmarks", "meetingWorkspace", "discoveryMarketplace"]) {
  assert(new RegExp(`${key}: hidden\\(`).test(scope), `${key} must be hidden from V1.`);
}
for (const key of ["bots", "webhooks", "plugins", "enterprise", "ssoScim", "billing", "aiFeatures"]) {
  assert(new RegExp(`${key}: postV1\\(`).test(scope), `${key} must be post-V1.`);
}
assert(appConfig.includes("supportedPlatforms: v1ReleaseScope.supportedPlatforms"), "Build metadata must consume the V1 platform registry.");
assert(navigation.includes("isV1GlobalNavigationEnabled"), "Global navigation must consume the V1 gate.");
assert(serverRail.includes("isV1CommunityKindEnabled"), "Community rail must consume the V1 gate.");
assert(helpNavigation.includes("isV1FeatureEnabled"), "Help navigation must consume the V1 gate.");
assert(settings.includes("isV1FeatureEnabled"), "Settings navigation must consume the V1 gate.");
assert(app.includes("isV1DeepLinkTypeEnabled"), "Renderer deep links must consume the V1 gate.");
assert(app.includes("isV1SearchCategoryEnabled"), "Global search must consume the V1 gate.");
assert(!app.includes('id: "cmd-saved-messages"'), "Hidden bookmarks must not remain in command navigation.");
assert(scopeDoc.includes("Windows") && scopeDoc.includes("IN_V1") && scopeDoc.includes("HIDDEN_FROM_V1"), "Scope release copy must state platform and classifications.");
assert(gateDoc.includes("deep link") && gateDoc.includes("Do not delete"), "Feature gate contract must cover deep links and code retention.");

const trackedLogoConsumers = [
  "src/components/LoginScreen.tsx",
  "src/components/RegisterScreen.tsx",
  "src/components/WindowTitleBar.tsx",
  "src/config/brandConfig.ts",
];
for (const file of trackedLogoConsumers) {
  const source = read(file);
  assert(!source.includes("picom-logo.png"), `${file} must not depend on an untracked logo.`);
  assert(source.includes("picom-logo-concept.png"), `${file} must use the tracked Picom logo.`);
}

if (failures.length) {
  console.error("Picom V1 Core scope contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Picom V1 Core scope contract passed.");
console.log("Release: Picom 1.0.0 stable | Supported stable platform: Windows");
console.log("Task 621 decision: voiceRooms and screenShare are HIDDEN_FROM_V1; retained source remains inaccessible.");
