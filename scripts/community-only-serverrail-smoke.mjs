import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build as viteBuild } from "vite";

const app = await readFile("src/App.tsx", "utf8");
const rail = await readFile("src/components/ServerRail.tsx", "utf8");
const communityListQuery = await readFile("src/services/communityListQuery.ts", "utf8");
const communityFactory = await readFile("src/utils/communityFactory.ts", "utf8");
const workspace = await readFile("src/components/community/CommunityWorkspace.tsx", "utf8");
const styles = await readFile("src/styles.css", "utf8");
const sidebar = await readFile("src/components/CommunitySidebar.tsx", "utf8");
const miniCard = await readFile("src/components/UserMiniCard.tsx", "utf8");
const globalCss = await readFile("src/components/navigation/globalNavigation.css", "utf8");

assert.match(app, /const communityServerRail = \(/);
assert.match(app, /<CommunityWorkspace serverRail=\{communityServerRail\}>/);
assert.equal((app.match(/<ServerRail/g) ?? []).length, 1, "ServerRail must have one community-owned mount definition");
assert.match(workspace, /aria-label="Community workspace"/);
assert.match(styles, /\.community-workspace\s*\{[^}]*overflow:\s*hidden;/s);
assert.doesNotMatch(rail, /onOpenHome|onOpenDirectMessages|onOpenSettings|onLogout/);
assert.doesNotMatch(rail, /Open mention feed|Direct messages|aria-label="Settings"|aria-label="Log out"/);
assert.match(communityListQuery, /currentUserMembershipUserId:\s*authData\.user\.id/);
assert.match(communityFactory, /currentUserMembershipUserId:\s*summary\.currentUserMembershipUserId/);
assert.match(rail, /Boolean\(community\.currentUserMembershipUserId\)/);
assert.match(rail, /Add community/);
assert.match(rail, /Discover communities/);
assert.doesNotMatch(sidebar, /aria-label="Settings"|aria-label="Log out"/);
assert.doesNotMatch(miniCard, /aria-label="Settings"|onOpenSettings/);
assert.match(globalCss, /\.global-app-sidebar\.is-compact/);

const bundles = await viteBuild({
  configFile: false,
  logLevel: "silent",
  build: {
    lib: { entry: "src/utils/communityFactory.ts", formats: ["es"], fileName: "community-factory" },
    write: false,
    minify: false,
  },
});
const factoryChunk = bundles[0]?.output.find((item) => item.type === "chunk");
assert.ok(factoryChunk, "Community factory must bundle for regression coverage");
const factoryModule = await import(`data:text/javascript;base64,${Buffer.from(factoryChunk.code).toString("base64")}`);
const makeSummary = (overrides = {}) => ({
  id: "community-1",
  kind: "text",
  ownerId: "owner-1",
  name: "Community",
  description: null,
  iconUrl: null,
  bannerUrl: null,
  accentColor: "#000000",
  visibility: "public",
  publicReadEnabled: true,
  defaultNotificationLevel: "mentions",
  typeSettings: {},
  rulesEnabled: false,
  rulesVersion: "v1",
  createdAt: null,
  updatedAt: null,
  ...overrides,
});
assert.equal(factoryModule.createCommunityFromSummary(makeSummary({ currentUserMembershipUserId: "owner-1" }), { includeTemplateChannels: false }).currentUserMembershipUserId, "owner-1");
assert.equal(factoryModule.createCommunityFromSummary(makeSummary({ currentUserMembershipUserId: "member-2" }), { includeTemplateChannels: false }).currentUserMembershipUserId, "member-2");
assert.equal(factoryModule.createCommunityFromSummary(makeSummary(), { includeTemplateChannels: false }).currentUserMembershipUserId, undefined);
assert.equal(Boolean(factoryModule.createCommunityFromSummary(makeSummary({ currentUserMembershipUserId: null }), { includeTemplateChannels: false }).currentUserMembershipUserId), false);

console.log("Community-only ServerRail smoke PASS");
