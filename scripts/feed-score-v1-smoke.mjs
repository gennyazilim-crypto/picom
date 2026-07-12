import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
function load(relativePath, requireModule = () => { throw new Error(`Unexpected import from ${relativePath}`); }) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, relativePath), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: relativePath,
  }).outputText;
  const module = { exports: {} };
  Function("require", "module", "exports", output)(requireModule, module, module.exports);
  return module.exports;
}

const calculator = load("src/services/feed/feedScoreV1.ts");
const fixtures = load("src/data/feedScoreV1Fixtures.ts", (request) => {
  if (request === "../services/feed/feedScoreV1") return calculator;
  throw new Error(`Unexpected fixture import: ${request}`);
});
const failures = fixtures.runFeedScoreV1Fixtures();
assert.deepEqual(failures, [], failures.join("\n"));
assert.equal(calculator.FEED_SCORE_V1.version, 1);
assert.equal(fixtures.feedScoreV1BaseFixtures.length, 7);
console.log("Feed Score V1 smoke passed (base scores, caps, eligibility, relevance, freshness, groups). ");

