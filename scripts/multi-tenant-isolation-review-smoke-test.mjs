import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

const doc = read("docs/multi-tenant-isolation-review.md");
const memberBoundaryTest = read("supabase/tests/member_only_community_access.sql");
const privateChannelTest = read("supabase/tests/private_channel_access_boundaries.sql");

for (const expected of [
  "Multi-Tenant Isolation Review",
  "Supabase RLS",
  "community_id",
  "Private channels",
  "Attachments",
  "Realtime",
  "Deep links",
  "Search",
  "Release blocker criteria",
  "production readiness still requires live Supabase RLS tests",
]) {
  assertIncludes(doc, expected, "multi-tenant isolation doc");
}

assertIncludes(memberBoundaryTest, "Member-only community access", "member boundary SQL test");
assertIncludes(privateChannelTest, "Private channel access boundary", "private channel SQL test");
assertIncludes(privateChannelTest, "Outsider should see neither", "private channel SQL test");

console.log("Multi-tenant isolation review smoke test passed.");
