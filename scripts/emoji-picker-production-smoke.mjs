import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const picker = readFileSync("src/components/EmojiPicker.tsx", "utf8");
const recentService = readFileSync("src/services/emojiRecentService.ts", "utf8");
const options = readFileSync("src/data/emojiOptions.ts", "utf8");
const composer = readFileSync("src/components/MessageComposer.tsx", "utf8");
const item = readFileSync("src/components/MessageItem.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

for (const marker of [
  'mode?: "composer" | "reaction"',
  "emojiRecentService.list()",
  "emojiRecentService.record",
  'event.key === "ArrowDown"',
  'event.key === "ArrowRight"',
  'event.key === "Home"',
  'role="tablist"',
  'role="listbox"',
  'aria-live="polite"',
]) assert.ok(picker.includes(marker), `missing picker behavior: ${marker}`);

for (const marker of ["picom.emoji-recents.v1", "MAX_RECENT_EMOJIS = 24", "isRecentEmoji", "localStorage"]) {
  assert.ok(recentService.includes(marker), `missing recent service guard: ${marker}`);
}

assert.ok(options.includes('frequent: "Recent"'), "frequent category must represent recent emojis");
assert.ok(options.includes('emoji: "👍"'), "emoji data must contain valid Unicode");
assert.ok(composer.includes('mode="composer"'), "composer must use insert mode");
assert.ok(item.includes('mode="reaction"'), "message picker must use reaction mode");
assert.ok(styles.includes(".emoji-picker-grid button:focus-visible"), "keyboard focus must be visible");
assert.ok(styles.includes("var(--focus-ring)"), "focus styling must use design tokens");

console.log("Emoji picker production polish smoke: PASS");
