import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const composer = readFileSync(resolve(root, "src/components/MessageComposer.tsx"), "utf8");
const upload = readFileSync(resolve(root, "src/services/uploadService.ts"), "utf8");
const file = readFileSync(resolve(root, "src/services/fileService.ts"), "utf8");

for (const marker of [
  '"pending" | "uploading" | "uploaded" | "failed" | "canceled"',
  "AbortController",
  "Cancel upload for",
  "Retry upload for",
  "Remove failed upload",
  "composer-preview-progress",
  "Retry or remove failed uploads before sending.",
]) assert.ok(composer.includes(marker), `Missing upload UX marker: ${marker}`);

for (const marker of ["signal?: AbortSignal", "UPLOAD_CANCELED", "validateContent", "upsert: false"]) {
  assert.ok(upload.includes(marker), `Missing upload service safety marker: ${marker}`);
}

for (const marker of ["image/png", "image/jpeg", "image/webp", "image/gif", "maxImageFileSizeBytes"]) {
  assert.ok(file.includes(marker), `Missing file validation marker: ${marker}`);
}

console.log("Media upload UX v2 contract tests passed.");
