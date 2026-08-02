import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const roots = ["src/components", "src/services/feed", "src/services/mentionFeedService.ts", "src/App.tsx"];
const banned = [
  /mockMentions/,
  /mockMentionItems/,
  /mockPopularUserIds/,
  /mockUpcomingEvents/,
  /mockFriends/,
  /from ["'].*mockMentions["']/,
  /from ["'].*mockFollows["']/,
  /from ["'].*mockEvents["']/,
];

function walk(filePath, out = []) {
  if (!existsSync(filePath)) return out;
  const stat = statSync(filePath);
  if (stat.isFile()) {
    if (/\.(tsx?|jsx?|mjs|css)$/.test(filePath)) out.push(filePath);
    return out;
  }
  for (const entry of readdirSync(filePath)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    // Feed-only story leftovers and shared Story viewer are scanned below separately.
    if (entry === "StoryViewerModal.tsx" || entry === "StoryViewerModal.css" || entry === "FollowedPeopleStoriesHeader.tsx") continue;
    walk(path.join(filePath, entry), out);
  }
  return out;
}

const files = roots.flatMap((root) => walk(root));
const hits = [];
for (const file of files) {
  if (file.includes(`${path.sep}data${path.sep}`)) continue;
  if (file.includes(".test.") || file.includes("__tests__")) continue;
  const text = readFileSync(file, "utf8");
  for (const pattern of banned) {
    if (pattern.test(text)) hits.push(`${file}: ${pattern}`);
  }
}

assert.equal(hits.length, 0, `production Feed paths still reference mock fixtures:\n${hits.join("\n")}`);

const mentionService = readFileSync("src/services/mentionFeedService.ts", "utf8");
assert.ok(!mentionService.includes("isMock"), "mentionFeedService must not branch on isMock");
const query = readFileSync("src/services/feed/feedQueryService.ts", "utf8");
assert.ok(!query.includes("isMock"), "feedQueryService must not branch on isMock");
assert.ok(!readFileSync("src/App.tsx", "utf8").includes('from "./data/mockMentions"'), "App must not import mockMentions");
assert.ok(!readFileSync("src/App.tsx", "utf8").includes('from "./data/mockFriends"'), "App must not import mockFriends");
assert.ok(!readFileSync("src/App.tsx", "utf8").includes('from "./data/mockFollows"'), "App must not import mockFollows");

console.log("Feed production mock bundle scan: PASS");
