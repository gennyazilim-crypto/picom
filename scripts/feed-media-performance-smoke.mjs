import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const mapperSource = readFileSync("src/services/feed/feedAttachmentModel.ts", "utf8");
const thumbSource = readFileSync("src/services/attachmentThumbnailService.ts", "utf8");
const grid = readFileSync("src/components/AttachmentGrid.tsx", "utf8");
const upload = readFileSync("src/services/uploadService.ts", "utf8");
const windowSource = readFileSync("src/services/feed/feedWindowing.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const unified = readFileSync("src/components/UnifiedFeedList.tsx", "utf8");
const card = readFileSync("src/components/MentionFeedCard.tsx", "utf8");

assert.ok(!thumbSource.includes("EDGE_FUNCTION_PLACEHOLDER"), "placeholder processor marker must be removed");
assert.ok(!thumbSource.includes("IMAGE_PROCESSOR_NOT_CONFIGURED"), "legacy placeholder reason must be removed");
assert.ok(thumbSource.includes("NATIVE_ORIGINAL_PREVIEW"), "native preview processor required");
assert.ok(thumbSource.includes("resolveNativeImagePreviewUrl"), "native preview resolver required");
assert.ok(upload.includes("createNativePreviewMetadata"), "upload must use native preview metadata");
assert.ok(!upload.includes("createThumbnailPlaceholder"), "upload must not call placeholder API");
assert.ok(grid.includes("resolveNativeImagePreviewUrl"), "grid must use native preview resolver");
assert.ok(grid.includes("attachment-card-overflow"), "+N overflow tile required");
assert.ok(grid.includes("loading=\"lazy\""), "lazy loading required");
assert.ok(grid.includes("decoding=\"async\""), "async decode required");
assert.ok(mapperSource.includes("FeedAttachment"), "canonical FeedAttachment model required");
assert.ok(windowSource.includes("sliceFeedWindow"), "DOM windowing helper required");
assert.ok(unified.includes("sliceFeedWindow"), "UnifiedFeedList must window long feeds");
assert.ok(card.includes("memo("), "MentionFeedCard must be memoized");
assert.ok(app.includes("scheduleChangeRefresh"), "realtime change events must be debounced");

const compiledMapper = ts.transpileModule(mapperSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mapper = await import(`data:text/javascript;base64,${Buffer.from(compiledMapper).toString("base64")}`);

assert.equal(mapper.mapRpcAttachmentToFeed(null), null);
assert.equal(mapper.mapRpcAttachmentToFeed({ id: "a1" }), null);
const ok = mapper.mapRpcAttachmentToFeed({
  id: "a1",
  public_url: "https://example.test/a1.jpg",
  scan_status: "clean",
  mime_type: "image/jpeg",
  file_name: "shot.jpg",
  width: 800,
  height: 600,
});
assert.ok(ok);
assert.equal(ok.thumbnailUrl, null);
assert.equal(mapper.resolveFeedPreviewUrl(ok), "https://example.test/a1.jpg");

const privateRow = mapper.mapRpcAttachmentToFeed({
  id: "a2",
  storage_path: "message-attachments/user/a2.jpg",
  public_url: null,
  scan_status: "clean",
  mime_type: "image/jpeg",
});
assert.ok(privateRow);
assert.equal(privateRow.availabilityState, "unavailable");
assert.equal(privateRow.storagePath, "message-attachments/user/a2.jpg");
const hydrated = mapper.applySignedUrlsToFeedAttachments([privateRow], new Map([
  ["message-attachments/user/a2.jpg", "https://signed.example/a2.jpg"],
]));
assert.equal(hydrated[0].availabilityState, "available");
assert.equal(hydrated[0].originalUrl, "https://signed.example/a2.jpg");

const compiledWindow = ts.transpileModule(windowSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const windowing = await import(`data:text/javascript;base64,${Buffer.from(compiledWindow).toString("base64")}`);
const many = Array.from({ length: 500 }, (_, index) => ({ id: `item-${index}` }));
const sliced = windowing.sliceFeedWindow(many, { maxMounted: 120, keepTail: true });
assert.equal(sliced.items.length, 120);
assert.equal(sliced.trimmedLeading, 380);
assert.equal(sliced.total, 500);

const ensure = windowing.sliceFeedWindow(many, { maxMounted: 120, ensureId: "item-10" });
assert.ok(ensure.items.some((item) => item.id === "item-10"));

console.log("Feed media + windowing contract smoke: PASS");
