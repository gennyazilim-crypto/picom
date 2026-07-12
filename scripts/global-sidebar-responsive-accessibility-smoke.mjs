import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sidebar = await readFile("src/components/navigation/GlobalAppSidebar.tsx", "utf8");
const item = await readFile("src/components/navigation/GlobalNavItem.tsx", "utf8");
const userCard = await readFile("src/components/navigation/GlobalUserCard.tsx", "utf8");
const presence = await readFile("src/components/navigation/PresenceMenu.tsx", "utf8");
const css = await readFile("src/components/navigation/globalNavigation.css", "utf8");

assert.match(sidebar, /max-width: 1320px/);
assert.match(sidebar, /data-navigation-mode/);
assert.match(sidebar, /ArrowDown/);
assert.match(sidebar, /ArrowUp/);
assert.match(sidebar, /data-global-navigation-button/);
assert.match(item, /aria-current/);
assert.match(item, /aria-disabled/);
assert.match(item, /title=\{title\}/);
assert.match(userCard, /presenceTriggerRef/);
assert.match(presence, /Escape/);
assert.match(presence, /onClose\(true\)/);
assert.match(css, /width:216px/);
assert.match(css, /width:72px/);
assert.match(css, /min-height:44px/);
assert.match(css, /focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(css, /bottom-nav|mobile-nav/i);

console.log("Global sidebar responsive accessibility smoke PASS");
