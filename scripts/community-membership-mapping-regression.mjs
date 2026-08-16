import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: "custom" });
try {
  const { createCommunityFromSummary } = await vite.ssrLoadModule("/src/utils/communityFactory.ts");
  const summary = {
    id: "community-membership-regression",
    kind: "text",
    ownerId: "owner-user-id",
    currentUserMembershipUserId: "member-user-id",
    name: "Membership regression",
    description: null,
    iconUrl: null,
    bannerUrl: null,
    accentColor: "#007571",
    visibility: "private",
    publicReadEnabled: false,
    defaultNotificationLevel: "mentions",
    typeSettings: { kind: "text", voiceRoomsEnabled: true, defaultMemberRole: "member", allowForumChannels: true },
    rulesEnabled: false,
    rulesVersion: "1",
    discoveryListed: false,
    discoveryCategory: null,
    discoveryJoinPolicy: "open",
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
  };

  assert.equal(
    createCommunityFromSummary(summary).currentUserMembershipUserId,
    summary.currentUserMembershipUserId,
    "the current user membership identifier must survive query-summary-to-UI mapping",
  );
  assert.equal(
    createCommunityFromSummary({ ...summary, currentUserMembershipUserId: undefined }).currentUserMembershipUserId,
    undefined,
    "missing membership remains safely undefined",
  );
} finally {
  await vite.close();
}

console.log("community membership mapping regression: PASS");
