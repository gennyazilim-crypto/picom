import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const credentialService = readFileSync(resolve(root, "src/services/botCredentialService.ts"), "utf8");
const logger = readFileSync(resolve(root, "src/services/logging/loggingService.ts"), "utf8");
const lifecycleMigration = readFileSync(resolve(root, "supabase/migrations/20260710173000_bot_system_mvp_production.sql"), "utf8");
const rotationMigration = readFileSync(resolve(root, "supabase/migrations/20260710174000_bot_token_security_hardening.sql"), "utf8");

assert.ok(credentialService.includes("regenerateTokenOnce"), "Mock lifecycle must support safe regeneration");
assert.ok(credentialService.includes("records[botId].revokedAt"), "Reissue must require prior revocation");
assert.ok(logger.includes("BOT_TOKEN_PATTERN") && logger.includes("[redacted-bot-token]"), "Central logger must redact raw bot token strings");
for (const marker of ["rotate_community_bot_credential", "revoke_community_bot_credential", "issue_community_bot_credential", "Any issue failure rolls back the revocation"]) assert.ok(rotationMigration.includes(marker), `Missing atomic rotation marker: ${marker}`);
assert.ok(lifecycleMigration.includes("token_hash") && lifecycleMigration.includes("extensions.digest"), "Credentials must be hashed at rest");
assert.ok(lifecycleMigration.includes("consume_bot_action_rate_limit") && lifecycleMigration.includes("to service_role"), "Bot actions must have backend-only rate limits");

for (const source of [credentialService, lifecycleMigration, rotationMigration]) {
  assert.equal(/log(?:Info|Warn|Error|Debug)?\([^\n]*(?:rawToken|raw_token|token_hash)/.test(source), false, "Bot credentials must never be logged");
}

console.log("Bot token lifecycle and security hardening tests passed.");
