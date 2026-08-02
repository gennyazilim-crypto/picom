import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const signingSource = readFileSync("src/services/feed/feedAttachmentSigning.ts", "utf8");
const mentionSource = readFileSync("src/services/mentionFeedService.ts", "utf8");
const mainSource = readFileSync("src/components/MentionFeedMain.tsx", "utf8");
const sessionSource = readFileSync("src/hooks/useProtectedDesktopSession.ts", "utf8");

assert.ok(signingSource.includes("FEED_ATTACHMENT_SIGNED_URL_TTL_SECONDS"), "TTL constant required");
assert.ok(signingSource.includes("FEED_ATTACHMENT_SIGN_BATCH_LIMIT"), "batch bound required");
assert.ok(signingSource.includes("isSafeMessageAttachmentStoragePath"), "path guard required");
assert.ok(signingSource.includes("FeedSignedUrlCache"), "signed URL cache required");
assert.ok(mentionSource.includes("signFeedAttachmentPaths"), "mention feed must batch-sign");
assert.ok(mentionSource.includes("feedSignedUrlCache"), "mention feed must use cache");
assert.ok(mentionSource.includes("MENTION_FEED_ABORTED"), "stale/abort handling required");
assert.ok(sessionSource.includes("resetMentionFeedAttachmentSigning"), "logout must clear feed signed URL cache");

const effectMatch = mainSource.match(/feedQueryService\.refresh\([\s\S]*?\}, \[([^\]]*)\]/);
assert.ok(effectMatch, "ranked refresh effect deps required");
assert.ok(!/\bitems\b/.test(effectMatch[1]), "ranked refresh must not re-run on items merge");
assert.ok(/\bactiveFilter\b/.test(effectMatch[1]) && /\bactiveTab\b/.test(effectMatch[1]), "ranked refresh still follows tab/filter");

const stripped = signingSource.replace(
  /import\s+\{[^}]+\}\s+from\s+"[^"]+";\s*/g,
  'const MESSAGE_ATTACHMENTS_BUCKET = "message-attachments";\n',
);
const compiled = ts.transpileModule(stripped, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const signing = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

assert.equal(signing.isSafeMessageAttachmentStoragePath("../x"), false);
assert.equal(signing.isSafeMessageAttachmentStoragePath("/abs"), false);
assert.equal(signing.isSafeMessageAttachmentStoragePath("a\\b"), false);
assert.equal(signing.isSafeMessageAttachmentStoragePath("communities/c/channels/ch/attached/u/a.png"), true);

const cache = new signing.FeedSignedUrlCache();
cache.setUser("u1");
cache.set("p1", "https://example.test/1", 3600);
assert.equal(cache.get("p1"), "https://example.test/1");
cache.setUser("u2");
assert.equal(cache.get("p1"), null);

const calls = { batch: 0, single: 0 };
const signer = {
  async createSignedUrls(paths) {
    calls.batch += 1;
    return paths.map((path) => (
      path.includes("fail")
        ? { path, signedUrl: null, error: "x" }
        : { path, signedUrl: `https://signed.test/${path}`, error: null }
    ));
  },
  async createSignedUrl(path) {
    calls.single += 1;
    if (path.includes("fail")) return null;
    return { signedUrl: `https://signed.test/${path}` };
  },
};

const allOk = await signing.signFeedAttachmentPaths(signer, ["a.png", "a.png", "b.png"]);
assert.equal(allOk.size, 2);
assert.equal(calls.batch, 1);

const partial = await signing.signFeedAttachmentPaths(signer, ["ok.png", "fail-one.png"]);
assert.ok(partial.has("ok.png"));
assert.equal(partial.has("fail-one.png"), false);

const abort = new AbortController();
abort.abort();
const aborted = await signing.signFeedAttachmentPaths(signer, ["c.png"], { signal: abort.signal });
assert.equal(aborted.size, 0);

const pending = signing.collectPendingFeedStoragePaths([
  { originalUrl: null, storagePath: "communities/c/channels/ch/attached/u/a.png" },
  { originalUrl: "https://x", storagePath: "communities/c/channels/ch/attached/u/b.png" },
  { originalUrl: null, storagePath: "../evil" },
  { originalUrl: null, storagePath: "communities/c/channels/ch/attached/u/a.png" },
]);
assert.deepEqual(pending, ["communities/c/channels/ch/attached/u/a.png"]);

console.log("Feed attachment signing + ranked refresh contract smoke: PASS");
