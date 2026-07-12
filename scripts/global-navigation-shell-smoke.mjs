import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const registry = read("src/services/navigation/globalNavigationRegistry.ts");
const sidebar = read("src/components/navigation/GlobalAppSidebar.tsx");
const shell = read("src/components/navigation/AuthenticatedAppShell.tsx");
const router = read("src/components/navigation/AppWorkspaceRouter.tsx");
const app = read("src/App.tsx");
const css = read("src/components/navigation/globalNavigation.css");

const ordered = ["feed", "dm", "communities", "radio", "podcasts", "events", "bookmarks"];
let previous = -1;
for (const key of ordered) {
  const index = registry.indexOf(`key: "${key}"`);
  assert.ok(index > previous, `Global navigation order is invalid at ${key}`);
  previous = index;
}
assert.match(registry, /key: "settings"/);
assert.match(registry, /key: "helpSupport"/);
assert.match(registry, /badgeSelector/);
assert.match(sidebar, /aria-label="Picom global navigation"/);
assert.match(sidebar, /aria-label="Main navigation"/);
assert.match(sidebar, /global-user-card/);
assert.match(shell, /GlobalAppSidebar/);
assert.match(shell, /AppWorkspaceRouter/);
assert.match(router, /data-global-route/);
assert.match(app, /<AuthenticatedAppShell/);
assert.match(app, /activeView === "events"/);
assert.doesNotMatch(sidebar, /Discord/i);
assert.match(css, /width:216px/);
assert.match(css, /max-width:1320px/);
assert.match(css, /focus-visible/);
assert.match(css, /prefers-reduced-motion/);
console.log("Global navigation authenticated shell smoke test passed.");
