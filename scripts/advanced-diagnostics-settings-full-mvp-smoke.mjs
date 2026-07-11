import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const settings = read("src/components/SettingsModal.tsx");
const diagnostics = read("src/components/settings/DiagnosticsSection.tsx");
const logs = read("src/components/settings/LogsViewer.tsx");
const feedback = read("src/components/settings/FeedbackSection.tsx");
const cache = read("src/services/cacheManagementService.ts");
const migration = read("src/services/localDataMigrationService.ts");
const redaction = read("src/services/logging/logRedaction.ts");
const logging = read("src/services/logging/loggingService.ts");
const feedLayout = read("src/services/feed/feedUiStateService.ts");
const communityLayout = read("src/services/community/communityNavigationService.ts");

for (const marker of ["snapshot.app.commitShort", "snapshot.app.buildDate", "snapshot.serviceStatus.supabaseStatus", "snapshot.serviceStatus.realtimeStatus", "snapshot.serviceStatus.liveKitStatus"]) assert.ok(diagnostics.includes(marker), `missing diagnostics status: ${marker}`);
for (const marker of ["Copy filtered", "redactDiagnosticsValue(filtered)", "Clear recent redacted logs", "window.confirm"]) assert.ok(logs.includes(marker), `missing log control: ${marker}`);
for (const marker of ["Restart in Safe Mode", "Reset layout", "Reset local settings", "localDataMigrationStatus", "runCacheAction", "window.confirm", "Auth sessions, drafts, queued messages, and server data are preserved"]) assert.ok(settings.includes(marker), `missing advanced setting: ${marker}`);
assert.ok(!cache.includes("Message cache placeholder cleared") && !cache.includes("cache placeholders cleared"), "cache actions must not report fake placeholder success");
assert.ok(cache.includes("No persisted message cache exists") && cache.includes("Auth sessions, drafts, queued messages, and server data were preserved"), "cache scope must be truthful and bounded");
assert.ok(migration.includes("getStatus(): LocalDataMigrationStatus") && migration.includes("retainedBackupCount") && migration.includes("settingsSchemaVersion"), "local migration status must be available without reading auth data");
assert.ok(redaction.includes("PRIVATE_CONTENT_KEY_PATTERN") && redaction.includes("[redacted-private-content]") && logging.includes("redactDiagnosticValue(value)"), "diagnostics must redact private content fields in addition to secrets");
assert.ok(feedLayout.includes("resetLayoutState") && communityLayout.includes("resetRouteMemory"), "layout reset must use bounded stores");
assert.ok(feedback.includes("Open support") && feedback.includes("remoteConfigService.getSnapshot().urls.supportUrl") && feedback.includes("gennyazilim-crypto/picom/issues"), "support must have a configured safe-link fallback");
console.log("Advanced diagnostics, logs, cache, and data settings Full MVP smoke: PASS");
