import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

function loadTypeScriptModule(relativePath, requireModule = () => {
  throw new Error(`Unexpected runtime import in ${relativePath}`);
}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    fileName: relativePath,
  }).outputText;
  const module = { exports: {} };
  Function("require", "module", "exports", output)(requireModule, module, module.exports);
  return module.exports;
}

const classifier = loadTypeScriptModule("src/services/feed/feedSourceClassification.ts");
const fixtures = loadTypeScriptModule(
  "src/data/feedSourceClassificationFixtures.ts",
  (request) => {
    if (request === "../services/feed/feedSourceClassification") return classifier;
    throw new Error(`Unexpected fixture import: ${request}`);
  },
);

const failures = fixtures.runFeedSourceClassificationFixtures();
assert.deepEqual(failures, [], failures.join("\n"));
assert.equal(fixtures.feedContentClassificationFixtures.length, 7);
assert.deepEqual(
  fixtures.feedSourceReferenceFixtures.map((fixture) => fixture.expected),
  ["text_message", "radio_session", "radio_comment", "podcast_episode", "podcast_comment"],
);

console.log("Feed source classification smoke passed (7 content kinds, 5 source types). ");

