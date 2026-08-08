/**
 * Static smoke for TASK27 publisher stream management client + UI.
 * Asserts migration RPCs, fail-closed flags, no localStorage for secrets, one-time reveal UX.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const migrationPath = "supabase/migrations/20260808170000_publisher_stream_management.sql";
assert.ok(existsSync(path.join(root, migrationPath)), `missing ${migrationPath}`);
const migration = read(migrationPath);

const rpcNames = [
  "create_publisher_stream",
  "update_publisher_stream",
  "transition_publisher_stream",
  "schedule_publisher_stream",
  "cancel_publisher_stream",
  "prepare_publisher_stream",
  "create_publisher_stream_credential",
  "rotate_publisher_stream_credential",
  "revoke_publisher_stream_credential",
  "test_publisher_stream_credential",
  "list_my_publisher_streams",
  "get_my_publisher_stream",
  "link_publisher_stream_live_session",
  "root_terminate_publisher_stream",
];
for (const name of rpcNames) {
  assert.match(migration, new RegExp(`function public\\.${name}\\b`), `migration missing RPC ${name}`);
}

const credentialInsertBlocks = [...migration.matchAll(/insert into public\.publisher_stream_credentials\s*\(([\s\S]*?)\)\s*values/gi)];
assert.ok(credentialInsertBlocks.length >= 2, "expected credential insert statements");
for (const block of credentialInsertBlocks) {
  const cols = block[1].toLowerCase();
  assert.doesNotMatch(cols, /plaintext/, "credential insert must never include plaintext columns");
  assert.match(cols, /secret_hash/, "credential insert must store secret_hash");
}

const flags = read("src/services/featureFlagService.ts");
assert.match(flags, /enablePublisherStreamManagement/);
assert.match(flags, /enablePublisherExternalIngest/);
assert.match(flags, /publisherStreamManagement:\s*"enablePublisherStreamManagement"/);
assert.match(flags, /publisherExternalIngest:\s*"enablePublisherExternalIngest"/);
assert.match(
  flags,
  /enablePublisherStreamManagement:\s*appConfig\.environment !== "production"/,
);
assert.match(
  flags,
  /enablePublisherExternalIngest:\s*appConfig\.environment !== "production"/,
);

const clientConfig = read("supabase/functions/client-config/index.ts");
assert.match(clientConfig, /PICOM_ENABLE_PUBLISHER_STREAM_MANAGEMENT/);
assert.match(clientConfig, /PICOM_ENABLE_PUBLISHER_EXTERNAL_INGEST/);
assert.match(clientConfig, /enablePublisherStreamManagement:\s*readPublicBooleanEnv\("PICOM_ENABLE_PUBLISHER_STREAM_MANAGEMENT"\)/);
assert.match(clientConfig, /enablePublisherExternalIngest:\s*readPublicBooleanEnv\("PICOM_ENABLE_PUBLISHER_EXTERNAL_INGEST"\)/);

const hardeningPath = "supabase/migrations/20260808180000_publisher_stream_management_hardening.sql";
assert.ok(existsSync(path.join(root, hardeningPath)), `missing ${hardeningPath}`);
const hardening = read(hardeningPath);
assert.match(hardening, /STREAM_CREDENTIAL_USE_INGRESS_EDGE/);
assert.match(hardening, /STREAM_OBS_NOT_PUBLISHING/);
assert.match(hardening, /ready' then to_status in \('connecting', 'live'/);

const service = read("src/services/live/publisherStreamManagementService.ts");
assert.doesNotMatch(service, /localStorage\.(setItem|getItem|removeItem)/);
assert.match(service, /FEATURE_DISABLED/);
assert.match(service, /enablePublisherStreamManagement/);
assert.match(service, /enablePublisherExternalIngest/);
assert.match(service, /plaintextSecret/);
assert.match(service, /never log/i);
assert.match(service, /livekit-ingress/);
assert.match(service, /provisionForStream/);
assert.match(service, /action:\s*"delete"/);
assert.match(service, /action:\s*"get"/);

const ui = read("src/components/publisher/PublisherStreamsWorkspace.tsx");
assert.match(ui, /secretReveal/);
assert.match(ui, /setSecretReveal\(null\)/);
assert.match(ui, /alertdialog/);
assert.match(ui, /streamCredential\.revealWarning/);
assert.match(ui, /One-time secret reveal/i);
assert.doesNotMatch(ui, /localStorage\.(setItem|getItem|removeItem)/);
assert.match(ui, /onGoLive/);
assert.match(ui, /enablePublisherStreamManagement/);

const css = read("src/components/publisher/PublisherStreamsWorkspace.css");
assert.match(css, /\.publisher-streams/);
assert.match(css, /--publisher-radius/);

const dashboard = read("src/components/publisher/PublisherDashboardWorkspace.tsx");
assert.match(dashboard, /PublisherStreamsWorkspace/);
assert.match(dashboard, /enablePublisherStreamManagement/);

const catalog = read("src/services/localization/publisherProgramCatalog.ts");
for (const key of [
  "streams.title",
  "obs.panelTitle",
  "streamCredential.revealWarning",
  "streamHealth.label",
  "controlRoom.nativeStartHint",
  "streamStatus.live",
  "streamErrors.FEATURE_DISABLED",
]) {
  assert.match(catalog, new RegExp(`"${key.replace(/\./g, "\\.")}"`));
}

console.log("publisher-stream-management-smoke: PASS");
process.exit(0);
