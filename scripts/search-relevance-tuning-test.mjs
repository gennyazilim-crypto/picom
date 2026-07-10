import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const helperSource = readFileSync("src/utils/searchRelevance.ts", "utf8");
const compiled = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { normalizeSearchQuery, rankSearchResults } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const result = (id, category, label, detail = "") => ({ id, category, label, detail });
const ranked = rankSearchResults([
  result("contains", "Messages", "A note about Aurora design"),
  result("prefix", "Channels", "aurora-planning"),
  result("exact", "Communities", "Aurora"),
], "aurora");
assert.deepEqual(ranked.map(({ id }) => id), ["exact", "prefix", "contains"]);

assert.equal(rankSearchResults([
  result("message", "Messages", "Mira"),
  result("person", "People", "Mira"),
], "mira")[0].id, "person", "navigation categories should break equal text matches predictably");

assert.equal(normalizeSearchQuery("  İSTANBUL\u0000  "), "istanbul");
assert.deepEqual(rankSearchResults([result("irrelevant", "People", "Ada")], "krishna"), []);

const serviceSource = readFileSync("src/services/advancedSearchService.ts", "utf8");
for (const marker of [
  "canViewChannel(access, channel)",
  "visibleIds.has(message.channelId)",
  "message.deletedAt",
  "search_accessible_entities",
  "rankSearchResults(results, query)",
]) {
  assert.ok(serviceSource.includes(marker), `missing access/relevance contract: ${marker}`);
}

console.log("Search relevance and access-boundary tests passed.");
