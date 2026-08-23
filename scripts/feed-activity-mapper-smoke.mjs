import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const mapperSource = readFileSync("src/services/feed/feedActivityMapper.ts", "utf8");
const compiled = ts.transpileModule(mapperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mapper = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

assert.equal(mapper.mapMentionItemToActivity(null), null);
assert.equal(mapper.mapMentionItemToActivity({}), null);

const valid = mapper.mapMentionItemToActivity({
  id: "mention-m1",
  source: "popular_feed",
  communityId: "c1",
  channelId: "ch1",
  messageId: "m1",
  authorId: "u1",
  mentionedUserIds: ["u2"],
  body: "hello @u2",
  createdAt: "2026-08-02T10:00:00.000Z",
  attachments: [],
  reactions: [{ emoji: "🔥", count: 1, reactedByCurrentUser: true }],
  commentCount: 2,
  commentPreview: [{ id: "r1", authorId: "u3", body: "hi", createdAt: "2026-08-02T10:01:00.000Z" }],
  popularityScore: 12,
  isUnread: true,
  isSaved: false,
});
assert.ok(valid);
assert.equal(valid.messageId, "m1");
assert.equal(valid.tieBreakerId, "m1");
assert.equal(valid.replyCount, 2);

const duped = mapper.mapMentionItemsToActivities([
  valid && mapper.activityToMentionItem(valid),
  valid && { ...mapper.activityToMentionItem(valid), id: "mention-m1-dup" },
].filter(Boolean));
assert.equal(duped.length, 1);

const unified = mapper.mapUnifiedFeedItemToActivity({
  feedItemId: "feed-1",
  rankingScore: 9,
  rankingEpoch: "2026-08-02T00:00:00.000Z",
  mention: {
    id: "cm-1",
    sourceType: "text_message",
    sourceId: "m9",
    communityId: "c1",
    channelId: "ch1",
    authorId: "u1",
    mentionedUserId: "u2",
    preview: "ranked",
    createdAt: "2026-08-02T11:00:00.000Z",
    updatedAt: "2026-08-02T11:00:00.000Z",
    visibility: { communityVisibility: "public", channelPrivate: false, publicReadEnabled: true },
  },
  mentionedUserIds: ["u2"],
  metrics: { reactions: 0, comments: 1, listeners: 0, mentionCount: 1 },
  isUnread: false,
  isFollowRelated: true,
});
assert.ok(unified);
assert.equal(unified.activityId, "feed-1");

console.log("Feed activity mapper contract smoke: PASS");
