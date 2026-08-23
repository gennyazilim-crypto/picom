import assert from "node:assert/strict";
import test from "node:test";

const REQUIRED_FOLLOWERS = 5000;
const REQUIRED_MEMBERS = 3000;

function evaluateEligibilityPaths(input) {
  const paths = [];
  if (input.activeFollowerCount >= REQUIRED_FOLLOWERS) paths.push("follower_threshold");
  if (input.largestOwnedCommunityActiveMemberCount >= REQUIRED_MEMBERS) paths.push("community_founder_threshold");
  return paths;
}

function isEligible(paths, accountActive = true) {
  return accountActive && paths.length > 0;
}

test("rejects 4999 followers without community threshold", () => {
  const paths = evaluateEligibilityPaths({ activeFollowerCount: 4999, largestOwnedCommunityActiveMemberCount: 0 });
  assert.deepEqual(paths, []);
  assert.equal(isEligible(paths), false);
});

test("accepts exactly 5000 followers", () => {
  const paths = evaluateEligibilityPaths({ activeFollowerCount: 5000, largestOwnedCommunityActiveMemberCount: 0 });
  assert.deepEqual(paths, ["follower_threshold"]);
  assert.equal(isEligible(paths), true);
});

test("accepts 5001 followers", () => {
  const paths = evaluateEligibilityPaths({ activeFollowerCount: 5001, largestOwnedCommunityActiveMemberCount: 100 });
  assert.equal(paths.includes("follower_threshold"), true);
});

test("rejects 2999 community members", () => {
  const paths = evaluateEligibilityPaths({ activeFollowerCount: 0, largestOwnedCommunityActiveMemberCount: 2999 });
  assert.deepEqual(paths, []);
});

test("accepts exactly 3000 community members", () => {
  const paths = evaluateEligibilityPaths({ activeFollowerCount: 0, largestOwnedCommunityActiveMemberCount: 3000 });
  assert.deepEqual(paths, ["community_founder_threshold"]);
});

test("OR logic: community alone is enough", () => {
  const paths = evaluateEligibilityPaths({ activeFollowerCount: 1200, largestOwnedCommunityActiveMemberCount: 3128 });
  assert.deepEqual(paths, ["community_founder_threshold"]);
  assert.equal(isEligible(paths), true);
});

test("OR logic: followers alone is enough", () => {
  const paths = evaluateEligibilityPaths({ activeFollowerCount: 5000, largestOwnedCommunityActiveMemberCount: 10 });
  assert.deepEqual(paths, ["follower_threshold"]);
});

test("does not sum separate communities", () => {
  const paths = evaluateEligibilityPaths({ activeFollowerCount: 0, largestOwnedCommunityActiveMemberCount: 1700 });
  assert.equal(isEligible(paths), false);
});

test("both paths when both thresholds met", () => {
  const paths = evaluateEligibilityPaths({ activeFollowerCount: 5000, largestOwnedCommunityActiveMemberCount: 3000 });
  assert.deepEqual(paths, ["follower_threshold", "community_founder_threshold"]);
});

test("inactive account cannot be eligible even with thresholds", () => {
  const paths = evaluateEligibilityPaths({ activeFollowerCount: 9000, largestOwnedCommunityActiveMemberCount: 9000 });
  assert.equal(isEligible(paths, false), false);
});
