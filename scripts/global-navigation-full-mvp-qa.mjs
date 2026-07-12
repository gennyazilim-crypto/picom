import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const contractScripts = [
  "global-navigation-shell-smoke.mjs",
  "authenticated-route-feed-landing-smoke.mjs",
  "global-user-card-presence-smoke.mjs",
  "supabase-realtime-presence-integration-smoke.mjs",
  "community-only-serverrail-smoke.mjs",
  "settings-separation-smoke.mjs",
  "help-support-workspace-smoke.mjs",
  "global-sidebar-responsive-accessibility-smoke.mjs",
  "global-navigation-badges-notifications-deep-links-smoke.mjs",
];

for (const script of contractScripts) {
  const result = spawnSync(process.execPath, [`scripts/${script}`], { stdio: "inherit" });
  assert.equal(result.status, 0, `${script} failed with exit code ${result.status ?? "unknown"}`);
}

const app = await readFile("src/App.tsx", "utf8");
const registry = await readFile("src/services/navigation/globalNavigationRegistry.ts", "utf8");
const landing = await readFile("src/services/navigation/authenticatedRouteService.ts", "utf8");
const workspace = await readFile("src/components/community/CommunityWorkspace.tsx", "utf8");
const settings = await readFile("src/services/settingsService.ts", "utf8");
const sidebar = await readFile("src/components/navigation/GlobalAppSidebar.tsx", "utf8");

assert.match(landing, /AUTHENTICATED_DEFAULT_VIEW\s*=\s*"feed"/);
assert.match(app, /<AuthenticatedAppShell/);
assert.match(app, /activeView === "support"/);
assert.match(app, /globalNavigationBadgeService\.deriveBadges/);
assert.match(workspace, /\{serverRail\}/);
assert.match(app, /<CommunityWorkspace serverRail=\{communityServerRail\}>/);
assert.doesNotMatch(settings, /"Help Center"/);
for (const key of ["feed", "dm", "communities", "radio", "podcasts", "events", "bookmarks", "settings", "helpSupport"]) {
  assert.match(registry, new RegExp(`key: "${key}"`));
}
assert.match(sidebar, /aria-label="Main navigation"/);
assert.match(sidebar, /data-navigation-mode/);
assert.doesNotMatch(sidebar, /mobile|bottom navigation/i);

console.log("Global navigation Full MVP final QA contract PASS");
