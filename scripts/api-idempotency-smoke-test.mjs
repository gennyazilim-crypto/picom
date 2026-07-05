import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

function assertNotIncludes(text, forbidden, label) {
  if (text.includes(forbidden)) {
    throw new Error(`${label} contains forbidden content: ${forbidden}`);
  }
}

const shared = read("packages/shared/src/types/idempotency.ts");
const sharedIndex = read("packages/shared/src/types/index.ts");
const service = read("src/services/idempotencyKeyService.ts");
const docs = read("docs/api-idempotency-keys.md");

for (const expected of [
  "IDEMPOTENCY_KEY_HEADER",
  "Idempotency-Key",
  "IdempotencyOperation",
  "send_message",
  "create_community",
  "create_channel",
  "upload_attachment",
  "accept_invite",
  "create_invite",
  "create_webhook",
  "IdempotencyRecordDTO",
]) {
  assertIncludes(shared, expected, "shared idempotency types");
}

assertIncludes(sharedIndex, 'export * from "./idempotency";', "shared types index");

for (const expected of [
  "createIdempotencyKey",
  "validateIdempotencyKey",
  "createIdempotencyHeaders",
  "canRetryRequestSafely",
  "SAFE_METHODS",
  "POST",
  "PATCH",
  "DELETE",
]) {
  assertIncludes(service, expected, "idempotency service");
}

for (const expected of [
  "API Idempotency Keys",
  "clientMessageId",
  "Idempotency-Key",
  "Hash the raw key",
  "same key is reused with a different request body",
  "Idempotency keys are not authorization",
]) {
  assertIncludes(docs, expected, "idempotency docs");
}

for (const forbidden of ["passwordHash", "service_role", "refresh_token"]) {
  assertNotIncludes(shared + service, forbidden, "idempotency implementation");
}

console.log("API idempotency key smoke test passed.");

