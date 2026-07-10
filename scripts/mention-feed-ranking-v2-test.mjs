import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("src/utils/mentionFeedRanking.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { rankMentionFeedItems } = await import(moduleUrl);

const nowMs = Date.UTC(2026, 6, 10, 12);
const item = (overrides) => ({
  id: "base",
  source: "popular_feed",
  communityId: "community",
  channelId: "channel",
  messageId: "message",
  authorId: "author",
  mentionedUserIds: [],
  body: "content must not affect ranking",
  createdAt: new Date(nowMs - 2 * 60 * 60 * 1000).toISOString(),
  reactions: [],
  commentCount: 0,
  popularityScore: 0,
  ...overrides,
});

const privateItem = item({ id: "private", popularityScore: 100, isUnread: true });
const accessibleItem = item({ id: "accessible" });
assert.deepEqual(
  rankMentionFeedItems([privateItem, accessibleItem], { tab: "feed", followedUserIds: [], isAccessible: (candidate) => candidate.id !== "private", nowMs }).map(({ id }) => id),
  ["accessible"],
  "inaccessible items must be removed before ranking",
);

const followed = item({ id: "followed", authorId: "followed-user" });
const popular = item({ id: "popular", popularityScore: 50 });
assert.equal(rankMentionFeedItems([popular, followed], { tab: "feed", followedUserIds: ["followed-user"], isAccessible: () => true, nowMs })[0].id, "followed");

const unread = item({ id: "unread", isUnread: true });
assert.equal(rankMentionFeedItems([accessibleItem, unread], { tab: "feed", followedUserIds: [], isAccessible: () => true, nowMs })[0].id, "unread");

const engaged = item({ id: "engaged", reactions: [{ emoji: "ok", count: 16 }], commentCount: 9 });
assert.equal(rankMentionFeedItems([accessibleItem, engaged], { tab: "feed", followedUserIds: [], isAccessible: () => true, nowMs })[0].id, "engaged");

const recent = item({ id: "recent", createdAt: new Date(nowMs - 60 * 60 * 1000).toISOString() });
const old = item({ id: "old", createdAt: new Date(nowMs - 5 * 24 * 60 * 60 * 1000).toISOString() });
assert.equal(rankMentionFeedItems([old, recent], { tab: "feed", followedUserIds: [], isAccessible: () => true, nowMs })[0].id, "recent");

const followingMatch = item({ id: "following-match", source: "following", mentionedUserIds: ["followed-user"] });
const followingMiss = item({ id: "following-miss", source: "following" });
assert.deepEqual(
  rankMentionFeedItems([followingMiss, followingMatch, accessibleItem], { tab: "following", followedUserIds: ["followed-user"], isAccessible: () => true, nowMs }).map(({ id }) => id),
  ["following-match"],
);

console.log("Mention Feed ranking v2 unit tests passed.");
