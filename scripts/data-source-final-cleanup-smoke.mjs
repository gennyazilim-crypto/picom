import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const read = (path) => readFileSync(path, "utf8");
const policy = read("src/config/dataSourcePolicy.ts");
const appConfig = read("src/config/appConfig.ts");
const service = read("src/services/dataSourceService.ts");
assert.ok(policy.includes('normalized === "mock" || normalized === "supabase"'), "data source values must be explicit");
assert.ok(policy.includes('mode: "supabase"') && policy.includes("Fake data fallback is disabled"), "invalid mode must fail toward Supabase, not mock");
assert.ok(policy.includes("isProductionRuntime") && policy.includes("V1 stable and production builds require VITE_DATA_SOURCE=supabase"), "production must reject mock and missing data-source selection");
assert.ok(appConfig.includes("resolveDataSourceDecision") && appConfig.includes("dataSourceConfigurationError"), "app config must consume the authoritative data-source decision");
assert.ok(service.includes("appConfig.dataSourceConfigurationError") && !service.includes("resolveDataSourceDecision"), "central status must consume the app-level decision without re-resolving it");
const startup = read("src/services/productionRuntimeConfigService.ts");
const main = read("src/main.tsx");
assert.ok(startup.includes("PRODUCTION_MOCK_FORBIDDEN") && startup.includes("SUPABASE_CONFIGURATION_INVALID"), "startup configuration gate is incomplete");
assert.ok(main.includes("productionRuntimeConfigService.getConfiguration()") && main.includes("ProductionConfigurationError"), "renderer must stop before App mounts when production data is unavailable");
const gatedFixtures = ["mockCommunities", "mockFollows", "mockMentions", "mockDirectMessages", "mockFriends", "mockEvents", "mockStories", "mockFollowSuggestions", "mockProfiles", "mockStickers", "mockUnifiedContentMentions"];
for (const name of gatedFixtures) assert.ok(read(`src/data/${name}.ts`).includes("selectMockFixture"), `${name} is not gated`);
const profile = read("src/services/profileActivityService.ts");
assert.ok(profile.includes("productionProfileBase") && profile.includes("coverUrl: undefined") && profile.includes('joinedAt: ""'), "production profile fallback contains generated fields");
for (const path of ["src/services/diagnostics/diagnosticsService.ts", "src/services/maintenanceStatusService.ts", "src/services/networkStatusService.ts"]) {
  const source = read(path); assert.ok(source.includes("dataSourceService"), `${path} bypasses central status`); assert.ok(!source.includes('appConfig.dataSource === "mock"'), `${path} duplicates mode selection`);
}
function walk(path, output = []) { if (!existsSync(path)) return output; if (statSync(path).isFile()) { output.push(path); return output; } for (const entry of readdirSync(path)) walk(join(path, entry), output); return output; }
const allowedPureHelpers = new Set(["src/services/communityListQuery.ts", "src/services/channelListQuery.ts", "src/services/messageListQuery.ts", "src/services/messageSendMutation.ts"]);
for (const path of walk("src/services").filter((item) => /\.(ts|tsx)$/.test(item))) {
  const normalized = relative(process.cwd(), path).replaceAll("\\", "/"); const source = read(path);
  if (!/(?:data\/mock|\.\.\/data\/mock)/.test(source) || allowedPureHelpers.has(normalized)) continue;
  assert.ok(source.includes("dataSourceService"), `${normalized} imports mock data without central mode selection`);
}
assert.ok(!read("src/components/StickerPicker.tsx").includes("dataSourceService"), "components must not branch on data source mode");
console.log("Explicit mock mode, production-empty fixtures, centralized branching, and no-silent-fallback audit: PASS");
