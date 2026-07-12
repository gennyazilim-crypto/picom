import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const scope = read("src/config/v1ReleaseScope.ts");
const routes = read("src/services/navigation/authenticatedRouteService.ts");
const navigation = read("src/services/navigation/globalNavigationRegistry.ts");
const app = read("src/App.tsx");
const dataSource = read("src/services/dataSourceService.ts");
const productionRuntime = read("src/services/productionRuntimeConfigService.ts");
const acceptance = read("docs/v1-core-functional-acceptance.md");

for (const feature of ["desktopShell", "firstLaunch", "supabaseAuth", "feed", "textCommunities", "textMessaging", "attachments", "replies", "reactions", "readState", "profile", "friends", "directMessages", "userSettings", "communityAdmin", "helpSupport", "safeDiagnostics"]) {
  assert.ok(new RegExp(`${feature}: inV1\\(`).test(scope), `${feature} must remain IN_V1`);
}
for (const feature of ["radio", "podcasts", "events", "bookmarks", "meetingWorkspace", "discoveryMarketplace"]) {
  assert.ok(new RegExp(`${feature}: hidden\\(`).test(scope), `${feature} must remain hidden`);
}
assert.ok(routes.includes('AUTHENTICATED_DEFAULT_VIEW = "feed"'), "authenticated default route must be Feed");
for (const reason of ["login", "registration", "onboarding_complete", "session_restore", "relaunch"]) assert.ok(routes.includes(`"${reason}"`), `missing Feed landing reason ${reason}`);
assert.ok(navigation.includes('key: "dm"') && navigation.includes("isV1GlobalNavigationEnabled"), "DM must be routed through the V1 global registry");
assert.ok(app.includes("createAuthenticatedLandingIntent") && app.includes("isV1DeepLinkTypeEnabled"), "App must use centralized landing and deep-link gates");
assert.ok(dataSource.includes("appConfig.dataSourceConfigurationError ?? getSupabaseConfiguredReason()"), "Supabase configuration errors must remain centralized");
assert.ok(productionRuntime.includes("PRODUCTION_MOCK_FORBIDDEN") && productionRuntime.includes("SUPABASE_CONFIGURATION_INVALID"), "stable production must fail closed without Supabase");
assert.ok(acceptance.includes("BLOCKED_HOSTED") && acceptance.includes("BLOCKED_NATIVE"), "acceptance matrix must distinguish unavailable external evidence");
assert.ok(!acceptance.includes("Hosted staging | PASS"), "documentation cannot claim a hosted PASS without evidence");
console.log("Picom V1 Core functional acceptance contract passed; hosted/native rows remain blocked until real evidence exists.");
