import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const policy = read("src/config/dataSourcePolicy.ts");
const config = read("src/config/appConfig.ts");
const status = read("src/services/dataSourceService.ts");
const startup = read("src/services/productionRuntimeConfigService.ts");
const main = read("src/main.tsx");
const errorView = read("src/components/ProductionConfigurationError.tsx");
const feed = read("src/components/MentionFeedMain.tsx");

assert.match(policy, /isProductionRuntime/);
assert.match(policy, /V1 stable and production builds require VITE_DATA_SOURCE=supabase/);
assert.match(policy, /decision\.explicit && decision\.mode === "mock" && !decision\.reason/);
assert.match(config, /dataSource: dataSourceDecision\.mode/);
assert.match(config, /dataSourceConfigurationError: dataSourceDecision\.reason/);
assert.match(status, /appConfig\.dataSourceConfigurationError \?\? getSupabaseConfiguredReason\(\)/);
assert.match(startup, /DATA_SOURCE_NOT_EXPLICIT/);
assert.match(startup, /PRODUCTION_MOCK_FORBIDDEN/);
assert.match(startup, /SUPABASE_CONFIGURATION_INVALID/);
assert.match(main, /if \(!productionConfiguration\.ready\)/);
assert.ok(main.indexOf("if (!productionConfiguration.ready)") < main.indexOf("localDataMigrationService.migrateOnStartup()"), "configuration must block before application data startup");
assert.match(errorView, /will not replace unavailable production data with mock content/);
assert.doesNotMatch(errorView, /anonKey|serviceRole|access_token|refresh_token/);
assert.doesNotMatch(feed, /dataSourceService\.getStatus\(\)\.isSupabase/);

console.log("Picom V1 production data-source startup contract: PASS");
console.log("Stable/production: explicit Supabase only; development/tests: explicit mock supported.");
