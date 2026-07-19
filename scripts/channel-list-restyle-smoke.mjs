import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/styles.css"), "utf8");

const channelBlock = css.slice(css.indexOf("/* Task 082"), css.indexOf("/* Task 087"));
assert.match(channelBlock, /\.channel-scroll\s*\{[^}]*background:\s*transparent/s);
assert.match(channelBlock, /\.channel-category\s*\{[^}]*background:\s*transparent/s);
assert.match(channelBlock, /\.channel-category\s*\{[^}]*border:\s*0/s);
assert.doesNotMatch(channelBlock, /radial-gradient\(ellipse 90%/);
assert.match(channelBlock, /inset 3px 0 0 var\(--picom-teal\)/);

console.log("channel-list flat surface smoke ok");
