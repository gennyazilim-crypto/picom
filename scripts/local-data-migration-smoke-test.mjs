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
  "Current schema version: `2`",
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

console.log("Client local data migration smoke test passed.");
