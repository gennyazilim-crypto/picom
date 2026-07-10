import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const edge = readFileSync(resolve(root, "supabase/functions/webhook-message/index.ts"), "utf8");
const delivery = readFileSync(resolve(root, "supabase/migrations/20260710084000_webhook_production_foundation.sql"), "utf8");
const hardening = readFileSync(resolve(root, "supabase/migrations/20260710175000_webhook_production_hardening.sql"), "utf8");
const service = readFileSync(resolve(root, "src/services/webhookService.ts"), "utf8");
const message = readFileSync(resolve(root, "src/components/MessageItem.tsx"), "utf8");

assert.ok(edge.includes('request.headers.get("x-picom-webhook-token")'), "Token header is required");
assert.equal(edge.includes('url.searchParams.get("token")'), false, "Query-string token must be rejected");
for (const marker of ["allowedPayloadKeys", "maxRequestBytes", "content.length > 2000", "unsupported fields"]) assert.ok(edge.includes(marker), `Missing payload guard: ${marker}`);
for (const marker of ["can_manage_channel_webhooks", "channel.type = 'text'", "extensions.gen_random_bytes(32)", "extensions.digest", "revoke insert, update, delete", "append_community_audit_log"]) assert.ok(hardening.includes(marker), `Missing trusted management guard: ${marker}`);
for (const marker of ["consume_webhook_rate_limit", "WEBHOOK_RATE_LIMITED", "webhook_id", "webhook_name", "service_role"]) assert.ok(delivery.includes(marker), `Missing delivery guard: ${marker}`);
assert.ok(service.includes("endpointUrl") && service.includes("tokenOnce") && !service.includes("&token="), "Service must separate endpoint and one-time token");
assert.ok(message.includes("webhook-badge") && message.includes("WEBHOOK"), "Webhook messages must be clearly marked");
assert.equal(message.includes("dangerouslySetInnerHTML"), false, "Webhook message content must never render as unsafe HTML");

console.log("Webhook production hardening contract tests passed.");
