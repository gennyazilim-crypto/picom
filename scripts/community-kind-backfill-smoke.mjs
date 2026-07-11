import { readFileSync } from "node:fs";

const read = (filePath) => readFileSync(filePath, "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const migration = read("supabase/migrations/20260711000200_existing_communities_text_backfill.sql");
for (const marker of [
  "to_regtype('public.community_kind')",
  "COMMUNITY_KIND_COLUMN_REQUIRED",
  "set kind = 'text'::public.community_kind",
  "where kind is null",
  "alter column kind set default",
  "alter column kind set not null",
  "COMMUNITY_KIND_BACKFILL_INCOMPLETE",
]) assert(migration.includes(marker), `Backfill migration is missing ${marker}`);
assert(!/\b(delete from|truncate|drop table|drop column)\b/iu.test(migration), "Backfill migration contains a destructive statement");

const seed = read("supabase/seed.sql");
assert(seed.includes("owner_id, kind, name"), "Community seed does not declare kind explicitly");
assert((seed.match(/'text'::public\.community_kind/gu) ?? []).length >= 2, "Legacy seed communities are not explicitly text");
assert(seed.includes("kind = excluded.kind"), "Seed conflict update does not preserve explicit text classification");

const mocks = read("src/data/mockCommunities.ts");
const activeKinds = [...mocks.matchAll(/makeCommunity\(\{[^}]*?kind:\s*"([^"]+)"/gu)].map((match) => match[1]);
assert(activeKinds.length >= 5 && activeKinds.every((kind) => kind === "text"), "Existing primary mock communities must all be explicit text communities");
for (const kind of ["text", "radio", "podcast"]) assert(mocks.includes(`${kind}: Object.freeze({ id: "kind-example-${kind}", kind: "${kind}"`), `Kind example fixture is missing ${kind}`);

const query = read("src/services/communityListQuery.ts");
for (const marker of ["LEGACY_COMMUNITY_LIST_SELECT", "isMissingCommunityKindColumnError", 'code === "42703"', 'code === "PGRST204"', 'kind: "text"']) assert(query.includes(marker), `Legacy list fallback is missing ${marker}`);
const service = read("src/services/communityService.ts");
for (const marker of ["kind === \"text\"", "isMissingCommunityKindColumnError(currentResult.error)", "LEGACY_COMMUNITY_LIST_SELECT", "insertPayload"]) assert(service.includes(marker), `Legacy create fallback is missing ${marker}`);
const state = read("src/state/useMvpAppState.ts");
assert(state.includes("supportsTextChannels(community)"), "Channel navigation is not gated by community kind");

const runbook = read("docs/community-kind-backfill-runbook.md").toLowerCase();
for (const marker of ["idempotent", "owner", "admin", "moderator", "member", "visitor", "rollback", "forward-fix", "channels", "messages", "roles", "invites"]) assert(runbook.includes(marker), `Backfill runbook is missing ${marker}`);

console.log("Existing community text-kind backfill, legacy fallback, seed, mock, and audit contract passed.");
