import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

function assertNotMatches(text, pattern, label) {
  if (pattern.test(text)) {
    throw new Error(`${label} contains forbidden pattern: ${pattern}`);
  }
}

const settingsService = read("src/services/settingsService.ts");
const migrationService = read("src/services/localDataMigrationService.ts");
const main = read("src/main.tsx");
const doc = read("docs/client-local-data-migration.md");

for (const expected of [
  "schemaVersion",
  "currentSchemaVersion",
  "localSettingsMigrations",
  "migrateSettings",
  "normalizeSettings",
  "backupInvalidSettings",
  "picom-settings.backup",
  "accessibilitySettings",
]) {
  assertIncludes(settingsService, expected, "settingsService migration");
}

for (const expected of [
  "Settings schema version: `9`",
  "manifest version: `2`",
  "Corruption handling",
  "Auth tokens",
  "renderer-safe UI preferences",
]) {
  assertIncludes(doc, expected, "client local migration docs");
}

assertNotMatches(settingsService, /passwordHash/i, "settingsService migration");
assertNotMatches(settingsService, /access_token/i, "settingsService migration");
assertNotMatches(settingsService, /refresh_token/i, "settingsService migration");
assertNotMatches(settingsService, /service_role/i, "settingsService migration");

for (const expected of ["CURRENT_SCHEMA_VERSION = 2", "localDataMigrations", "migrateOnStartup", "migrateDrafts", "migrateCache", "MAX_BACKUPS = 5", "MAX_BACKUP_CHARS = 12_000"]) {
  assertIncludes(migrationService, expected, "v2 local data migration");
}
assertIncludes(main, "localDataMigrationService.migrateOnStartup()", "startup migration");
for (const forbidden of [/access_token/i, /refresh_token/i, /service_role/i, /passwordHash/i, /authorization.*getItem/i]) {
  assertNotMatches(migrationService, forbidden, "v2 local data migration");
}

console.log("Client local data migration smoke test passed.");
