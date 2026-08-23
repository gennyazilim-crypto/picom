import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const badgeSource = await readFile("src/services/navigation/globalNavigationBadgeService.ts", "utf8");
assert.match(badgeSource, /blockedUserIds/);
assert.match(badgeSource, /mutedCommunityIds/);
assert.match(badgeSource, /mutedChannelIds/);
assert.match(badgeSource, /doNotDisturb|notificationPolicy/);
assert.match(badgeSource, /export const globalNavigationBadgeService/);

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
