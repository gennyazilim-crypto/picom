import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile("src/App.tsx", "utf8");
const rail = await readFile("src/components/ServerRail.tsx", "utf8");
const workspace = await readFile("src/components/community/CommunityWorkspace.tsx", "utf8");
const sidebar = await readFile("src/components/CommunitySidebar.tsx", "utf8");
const miniCard = await readFile("src/components/UserMiniCard.tsx", "utf8");
const globalCss = await readFile("src/components/navigation/globalNavigation.css", "utf8");

assert.match(app, /const communityServerRail = \(/);
assert.match(app, /<CommunityWorkspace serverRail=\{communityServerRail\}>/);
assert.equal((app.match(/<ServerRail/g) ?? []).length, 1, "ServerRail must have one community-owned mount definition");
assert.match(workspace, /aria-label="Community workspace"/);
assert.match(workspace, /overflow: "hidden"/);
assert.doesNotMatch(rail, /onOpenHome|onOpenDirectMessages|onOpenSettings|onLogout/);
assert.doesNotMatch(rail, /Open mention feed|Direct messages|aria-label="Settings"|aria-label="Log out"/);
assert.match(rail, /Add community/);
assert.match(rail, /Discover communities/);
assert.doesNotMatch(sidebar, /onOpenSettings|onLogout/);
assert.doesNotMatch(miniCard, /aria-label="Settings"|onOpenSettings/);
assert.match(globalCss, /@media\(max-width:1320px\)/);

console.log("Community-only ServerRail smoke PASS");
