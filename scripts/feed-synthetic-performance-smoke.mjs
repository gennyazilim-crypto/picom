import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import ts from "typescript";
import os from "node:os";

const mapperSource = readFileSync("src/services/feed/feedAttachmentModel.ts", "utf8");
const windowSource = readFileSync("src/services/feed/feedWindowing.ts", "utf8");
const mapper = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(mapperSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText).toString("base64")}`);
const windowing = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(windowSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText).toString("base64")}`);

function makeItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `mention-${index}`,
    attachments: index % 7 === 0 ? [{
      id: `att-${index}`,
      public_url: `https://example.test/${index}.jpg`,
      scan_status: "clean",
      mime_type: "image/jpeg",
      file_name: `f-${index}.jpg`,
      width: 640,
      height: 360,
    }] : [],
  }));
}

function bench(label, count, fn) {
  const started = performance.now();
  const result = fn();
  const ms = performance.now() - started;
  return { label, count, ms: Number(ms.toFixed(2)), result };
}

const sizes = [25, 100, 500, 1000];
const rows = [];
for (const count of sizes) {
  rows.push(bench(`map+window:${count}`, count, () => {
    const items = makeItems(count).map((item) => ({
      id: item.id,
      attachments: mapper.mapRpcAttachments(item.attachments, item.id.replace("mention-", "msg-")),
    }));
    const unique = new Set(items.map((item) => item.id));
    assert.equal(unique.size, count);
    const windowed = windowing.sliceFeedWindow(items, { maxMounted: 120, keepTail: true });
    assert.ok(windowed.items.length <= 120);
    return { mounted: windowed.items.length, mediaCards: items.filter((item) => item.attachments.length).length };
  }));
}

const report = {
  machine: {
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    totalMemMb: Math.round(os.totalmem() / (1024 * 1024)),
    node: process.version,
  },
  method: "Node synthetic mapper+windowing microbench (not browser FPS). FPS/Electron CPU: NOT_RUN.",
  rows,
  acceptance: {
    duplicateIds: 0,
    mountedCap: 120,
    placeholderThumbnailUrls: 0,
  },
};

assert.ok(rows.every((row) => row.result.mounted <= 120));
assert.ok(rows.find((row) => row.count === 1000)?.ms < 250, "1000-item map+window should stay under 250ms on CI machine");

console.log(JSON.stringify(report, null, 2));
console.log("Feed synthetic performance smoke: PASS");
