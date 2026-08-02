import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("src/services/localizationService.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const { localizationService } = mod;

const keys = [
  "feed.loading", "feed.loadingMore", "feed.empty.title", "feed.empty.body", "feed.empty.unread",
  "feed.offline", "feed.error.title", "feed.error.body", "feed.retry", "feed.loadMore", "feed.end",
  "feed.newActivities", "feed.replies", "feed.reactions", "feed.saved", "feed.read", "feed.inaccessible",
  "feed.live.bandLabel", "feed.live.title", "feed.live.emptyTitle", "feed.companion.friends",
  "feed.companion.events", "feed.companion.voice",
  "feed.media.count", "feed.media.open", "feed.media.broken", "feed.media.viewerLabel", "feed.media.close",
];

for (const key of keys) {
  const en = localizationService.translate(key, "en");
  const tr = localizationService.translate(key, "tr");
  assert.ok(en && en !== key, `EN missing for ${key}`);
  assert.ok(tr && tr !== key, `TR missing for ${key}`);
  assert.notEqual(en, key);
  assert.notEqual(tr, key);
}

const interpolated = localizationService.translate("feed.live.count", { count: "3" }, "en");
assert.equal(interpolated, "3 live");

console.log("Feed i18n parity smoke: PASS");
