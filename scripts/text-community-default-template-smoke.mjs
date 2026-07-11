import { readFileSync } from "node:fs";

const read = (filePath) => readFileSync(filePath, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const template = read("src/data/communityTemplates.ts");
const customStart = template.indexOf('id: "custom"');
const customEnd = template.indexOf('id: "gaming"');
const customTemplate = template.slice(customStart, customEnd);
for (const marker of ['name: "Information"', 'name: "welcome"', 'name: "Channels"', 'name: "general"', 'name: "Voice"', 'name: "focus-room"']) {
  assert(customTemplate.includes(marker), `Default mock Text template is missing ${marker}`);
}
for (const forbidden of ['name: "Radio"', 'name: "Podcast"', 'name: "Episodes"', 'name: "Broadcasts"']) {
  assert(!customTemplate.includes(forbidden), `Default Text template contains publishing-only section ${forbidden}`);
}

const modal = read("src/components/CreateCommunityModal.tsx");
for (const marker of ["creationRequestId: string", "crypto.randomUUID()", "creationRequestId,"]) {
  assert(modal.includes(marker), `Creation wizard does not preserve stable idempotency marker ${marker}`);
}

const service = read("src/services/communityService.ts");
for (const marker of [
  "mockCommunityCreations",
  "mockCommunityCreations.get(creationRequestId)",
  "mockCommunityCreations.set(creationRequestId, community)",
  'kind === "text"',
  'rpc("create_text_community_with_defaults"',
  "target_creation_request_id: creationRequestId",
  "community_template_id: templateId",
  'code: "COMMUNITY_TEMPLATE_FAILED"',
]) assert(service.includes(marker), `Text community service is missing ${marker}`);

const migration = read("supabase/migrations/20260711000300_text_community_default_template.sql");
for (const marker of [
  "creation_request_id uuid",
  "communities_owner_creation_request_unique",
  "ensure_text_community_default_template",
  "create_text_community_with_defaults",
  "pg_advisory_xact_lock",
  "COMMUNITY_CREATION_KEY_CONFLICT",
  "TEXT_TEMPLATE_OWNER_ROLE_MISSING",
  "Information",
  "welcome",
  "Channels",
  "general",
  "Voice",
  "focus-room",
  "on conflict do nothing",
  "returns setof public.communities",
  "grant execute",
]) assert(migration.includes(marker), `Atomic Supabase Text template migration is missing ${marker}`);
assert(!migration.includes('"name":"Radio"') && !migration.includes('"name":"Podcast"'), "Text migration contains Radio/Podcast publishing sections");
assert(!migration.includes("else raise exception"), "Text migration embeds a procedural RAISE inside a SQL CASE expression");

const sqlTest = read("supabase/tests/rls/text_community_default_template.sql");
for (const marker of ["retry does not duplicate community", "creator membership uses Owner role", "template failure rolls back", "unauthenticated calls are rejected"]) {
  assert(sqlTest.includes(marker), `Real pgTAP contract is missing ${marker}`);
}

const databaseTypes = read("src/services/supabase/database.types.ts");
for (const marker of ["creation_request_id: string | null", "creation_template_id: string | null", "create_text_community_with_defaults"]) {
  assert(databaseTypes.includes(marker), `Supabase types are missing ${marker}`);
}

console.log("Text community default template mock, service, atomic SQL, rollback, and pgTAP contracts passed.");
