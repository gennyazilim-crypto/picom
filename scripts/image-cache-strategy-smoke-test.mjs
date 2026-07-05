import { readFileSync } from "node:fs";

const service = readFileSync("src/services/imageCacheService.ts", "utf8");
const doc = readFileSync("docs/image-cache-strategy.md", "utf8");

const checks = [
  [service.includes("MAX_MEMORY_ENTRIES"), "memory entry cap"],
  [service.includes("privacy === \"private\""), "private privacy guard"],
  [service.includes("attachment_full"), "full attachment cache kind"],
  [service.includes("attachment_thumbnail"), "thumbnail cache kind"],
  [service.includes("invalidateByPrefix"), "prefix invalidation"],
  [doc.includes("Do not cache private full images"), "private full image warning"],
  [doc.includes("signed URL"), "signed URL expiration guidance"],
  [doc.includes("Revoke object URLs"), "object URL cleanup guidance"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);

if (failed.length) {
  throw new Error(`Image cache strategy smoke test failed: ${failed.join(", ")}`);
}

console.log("Image cache strategy smoke test passed.");
