import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

const sharedPagination = read("packages/shared/src/types/pagination.ts");
const sharedIndex = read("packages/shared/src/types/index.ts");
const docs = read("docs/api-pagination.md");
const apiCompatibility = read("docs/api-compatibility.md");

for (const expected of [
  "PaginationCursor",
  "PaginationDirection",
  "PaginatedEndpointName",
  "PaginationRequest",
  "PaginationMeta",
  "PaginatedResponse",
  "items: TItem[]",
  "nextCursor: PaginationCursor",
  "previousCursor?: PaginationCursor",
  "hasMore: boolean",
  "limit: number",
]) {
  assertIncludes(sharedPagination, expected, "shared pagination types");
}

assertIncludes(sharedIndex, 'export * from "./pagination";', "shared types index");

for (const expected of [
  "API Pagination Standard",
  "items",
  "nextCursor",
  "previousCursor",
  "hasMore",
  "limit",
  "Messages",
  "Notifications",
  "Audit logs",
  "Members",
  "Search results",
  "Reports",
  "Saved messages",
  "Account activity",
  "Admin lists placeholder",
  "Supabase RLS remains the source of truth",
]) {
  assertIncludes(docs, expected, "API pagination docs");
}

for (const expected of ["Pagination compatibility", "nextCursor", "previousCursor", "hasMore", "limit"]) {
  assertIncludes(apiCompatibility, expected, "API compatibility docs");
}

console.log("API pagination standard smoke test passed.");

