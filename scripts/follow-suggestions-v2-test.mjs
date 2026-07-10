import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("src/utils/followSuggestionRanking.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { rankFollowSuggestions } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const member = (userId, roleId = "member") => ({ id: `member-${userId}`, userId, displayName: userId, username: userId, avatarSeed: userId, status: "online", statusText: "", roleId });
const current = member("current", "moderator");
const mutualRole = member("mutual-role", "moderator");
const mutualPopular = member("mutual-popular");
const blocked = member("blocked");
const followed = member("followed");
const outsider = member("outsider");
const community = {
  id: "community", name: "Community", icon: "C", accentColor: "red", categories: [], messages: [],
  roles: [{ id: "member", name: "Member", color: "gray", level: 10 }, { id: "moderator", name: "Moderator", color: "blue", level: 60 }],
  members: [current, mutualRole, mutualPopular, blocked, followed],
};
const mentions = [{ id: "mention", source: "popular_feed", communityId: "community", channelId: "channel", messageId: "message", authorId: "mutual-popular", mentionedUserIds: [], body: "ignored", createdAt: new Date().toISOString(), popularityScore: 100 }];

const ranked = rankFollowSuggestions({ candidates: [mutualPopular, blocked, current, followed, outsider, mutualRole], communities: [community], accessibleMentions: mentions, currentUserId: "current", followedUserIds: ["followed"], blockedUserIds: ["blocked"], limit: 10 });
assert.deepEqual(new Set(ranked.map(({ member: value }) => value.userId)), new Set(["mutual-role", "mutual-popular"]));
assert.equal(ranked[0].member.userId, "mutual-popular", "recent popular visible mentions should be relevant");
assert.ok(ranked.find(({ member: value }) => value.userId === "mutual-role")?.reasons.includes("Relevant community role"));
assert.ok(!ranked.some(({ member: value }) => ["blocked", "followed", "current", "outsider"].includes(value.userId)));

console.log("Follow suggestions v2 unit tests passed.");
