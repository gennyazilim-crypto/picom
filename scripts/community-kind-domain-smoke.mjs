import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (filePath) => readFileSync(filePath, "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const domainSource = read("src/types/community.ts");
const compiledDomain = ts.transpileModule(domainSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const domainModule = { exports: {} };
new Function("exports", "module", "require", compiledDomain)(domainModule.exports, domainModule, () => {
  throw new Error("Community domain helper unexpectedly required a runtime dependency.");
});
const domain = domainModule.exports;

assert(JSON.stringify(domain.COMMUNITY_KINDS) === JSON.stringify(["text", "radio", "podcast"]), "Canonical community kinds are incomplete");
for (const kind of ["text", "radio", "podcast"]) assert(domain.isCommunityKind(kind), `Expected ${kind} to be valid`);
for (const kind of ["hybrid", "voice", "", null, 1]) assert(!domain.isCommunityKind(kind), `Expected ${String(kind)} to be rejected`);
assert(domain.supportsTextChannels("text") && !domain.supportsTextChannels("radio") && !domain.supportsTextChannels("podcast"), "Text capability isolation failed");
assert(domain.supportsLiveRadio("radio") && !domain.supportsLiveRadio("text") && !domain.supportsLiveRadio("podcast"), "Radio capability isolation failed");
assert(domain.supportsPodcastPublishing("podcast") && !domain.supportsPodcastPublishing("text") && !domain.supportsPodcastPublishing("radio"), "Podcast capability isolation failed");

const migration = read("supabase/migrations/20260711000100_community_kind_domain.sql");
for (const marker of [
  "create type public.community_kind as enum ('text', 'radio', 'podcast')",
  "alter table public.communities add column kind public.community_kind",
  "COMMUNITY_KIND_MIGRATION_INVALID_EXISTING_VALUE",
  "set kind = 'text'::public.community_kind",
  "alter column kind set not null",
  "idx_communities_kind_created_at",
]) assert(migration.includes(marker), `Migration is missing ${marker}`);

const mockSource = read("src/data/mockCommunities.ts");
for (const kind of ["text", "radio", "podcast"]) assert(mockSource.includes(`kind: "${kind}"`), `Mock mode is missing ${kind} community data`);

const service = read("src/services/communityService.ts");
const query = read("src/services/communityListQuery.ts");
const databaseTypes = read("src/services/supabase/database.types.ts");
const sharedDto = read("packages/shared/src/dto/community.ts");
const schemaDocument = read("docs/community-kind-schema-rls.md");
const normalizedSchemaDocument = schemaDocument.toLowerCase();
for (const marker of ["kind?: CommunityKind", "isCommunityKind(input.kind)", "kind = input.kind ?? \"text\"", "kind,"]) assert(service.includes(marker), `Community service is missing ${marker}`);
for (const marker of ["id, kind, owner_id", "kind?: CommunityKind | null", 'const kind = row.kind ?? "text"', "kind: community.kind"]) assert(query.includes(marker), `Community query is missing ${marker}`);
assert(databaseTypes.includes('community_kind: "text" | "radio" | "podcast"'), "Generated Supabase enum type is missing");
assert(sharedDto.includes('CommunityKindDTO = "text" | "radio" | "podcast"'), "Shared DTO community kind is missing");
for (const marker of ["non-destructive", "rls", "no hybrid", "invalid values", "existing rows"]) assert(normalizedSchemaDocument.includes(marker), `Schema/RLS documentation is missing ${marker}`);

console.log("Community kind domain, migration, capability, mock, service, and Supabase type smoke passed.");
