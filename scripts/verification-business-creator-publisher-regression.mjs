import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function sha256(relativePath) {
  const bytes = readFileSync(resolve(root, relativePath));
  return createHash("sha256").update(bytes).digest("hex");
}

const publisherCore = "supabase/migrations/20260803140000_publisher_creator_program_core.sql";
const publisherEligibility = "supabase/migrations/20260803160000_publisher_eligibility_member_count_canonical.sql";
const foundation = "supabase/migrations/20260803173000_verification_business_platform_foundation.sql";

const publisherCoreSql = readFileSync(resolve(root, publisherCore), "utf8");
const eligibilitySql = readFileSync(resolve(root, publisherEligibility), "utf8");
const foundationSql = readFileSync(resolve(root, foundation), "utf8");

assert.match(publisherCoreSql, /v1-5k-followers-or-3k-founder/);
assert.match(publisherCoreSql, /follower_count_at_application >= 5000/);
assert.match(publisherCoreSql, /community_member_count_at_application >= 3000/);
assert.match(publisherCoreSql, /create table if not exists public\.publisher_profiles/);
assert.match(publisherCoreSql, /create table if not exists public\.publisher_badges/);
assert.match(eligibilitySql, /count\(distinct/i);
assert.match(eligibilitySql, /owner_id|created_by|founder/i);

assert.doesNotMatch(foundationSql, /drop table if exists public\.publisher_/i);
assert.doesNotMatch(foundationSql, /alter table public\.publisher_profiles/i);
assert.doesNotMatch(foundationSql, /alter table public\.publisher_badges/i);
assert.doesNotMatch(foundationSql, /alter table public\.publisher_applications/i);
assert.match(foundationSql, /create table if not exists public\.monetization_accounts/);
assert.match(foundationSql, /badge_status/);
assert.match(foundationSql, /monetization_status/);
assert.match(foundationSql, /payout_onboarding_status/);
assert.match(foundationSql, /compliance_status/);

const hashes = {
  publisherCore: sha256(publisherCore),
  publisherEligibility: sha256(publisherEligibility),
  foundation: sha256(foundation),
};

console.log(
  JSON.stringify(
    {
      ok: true,
      message: "Creator/Publisher regression contract intact; foundation does not mutate publisher tables.",
      hashes,
    },
    null,
    2,
  ),
);
