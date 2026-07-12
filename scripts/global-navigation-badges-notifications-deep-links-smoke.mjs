import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const badgeSource = await readFile("src/services/navigation/globalNavigationBadgeService.ts", "utf8");
const compiled = ts.transpileModule(badgeSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const badgeModule = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const community = { id: "community-1", kind: "text", categories: [{ id: "category-1", name: "General", channels: [{ id: "channel-1", name: "general", type: "text", unread: true, mentions: 2 }] }] };
const base = {
  communities: [community],
  directConversations: [{ id: "dm-1", participantUserId: "user-2", unreadCount: 3, messages: [] }],
  activeVoiceRooms: [],
  visibleEvents: [],
  blockedUserIds: [],
  notificationPolicy: { doNotDisturb: false, mutedCommunityIds: [], mutedChannelIds: [] },
  canViewChannel: () => true,
  now: Date.parse("2026-07-12T10:00:00.000Z"),
};

assert.deepEqual(badgeModule.globalNavigationBadgeService.deriveBadges(base), { dmUnread: 3, communityUnread: 2, radioLive: 0, eventUpcoming: 0, bookmarkCount: 0 });
assert.equal(badgeModule.globalNavigationBadgeService.deriveBadges({ ...base, blockedUserIds: ["user-2"], notificationPolicy: { ...base.notificationPolicy, mutedCommunityIds: ["community-1"] } }).dmUnread, 0);
assert.equal(badgeModule.globalNavigationBadgeService.deriveBadges({ ...base, blockedUserIds: ["user-2"], notificationPolicy: { ...base.notificationPolicy, mutedCommunityIds: ["community-1"] } }).communityUnread, 0);

const app = await readFile("src/App.tsx", "utf8");
const registry = await readFile("src/services/navigation/globalNavigationRegistry.ts", "utf8");
const policy = await readFile("src/services/navigation/notificationNavigationPolicyService.ts", "utf8");
const navItem = await readFile("src/components/navigation/GlobalNavItem.tsx", "utf8");
assert.match(app, /globalNavigationBadgeService\.deriveBadges/);
assert.match(app, /notificationNavigationPolicyService\.validate/);
assert.doesNotMatch(app, /communityUnread:\s*0,\s*\n\s*radioLive:\s*communities\.filter/);
assert.match(policy, /canViewChannel/);
assert.match(policy, /isAuthenticated/);
assert.match(registry, /key: "bookmarks"[\s\S]*badgeSelector: noBadge/);
assert.match(navItem, /destination=\{item\.label\}/);
console.log("Global navigation badges, notification routing, and deep-link privacy smoke PASS");
