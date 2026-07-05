import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "docs/api-sdk-generation.md",
  "packages/shared/src/index.ts",
  "packages/shared/src/dto/index.ts",
  "packages/shared/src/types/api.ts",
  "packages/shared/src/types/pagination.ts",
  "packages/shared/src/events/index.ts",
  "packages/shared/src/permissions/index.ts",
];

const missingFiles = requiredFiles.filter((file) => !existsSync(file));
if (missingFiles.length > 0) {
  console.error(`Missing API SDK planning files: ${missingFiles.join(", ")}`);
  process.exit(1);
}

const doc = readFileSync("docs/api-sdk-generation.md", "utf8");
const requiredPhrases = [
  "Supabase database types",
  "shared DTO",
  "OpenAPI",
  "Generated output must not be edited manually",
  "React components should not choose between mock and Supabase/API data sources directly",
  "passwordHash",
  "PaginationResponse",
  "ApiErrorShape",
];

const missingPhrases = requiredPhrases.filter((phrase) => !doc.includes(phrase));
if (missingPhrases.length > 0) {
  console.error(`API SDK generation plan is missing required coverage: ${missingPhrases.join(", ")}`);
  process.exit(1);
}

const sharedIndex = readFileSync("packages/shared/src/index.ts", "utf8");
const sharedExports = ["./dto", "./types", "./events", "./permissions"];
const missingExports = sharedExports.filter((entry) => !sharedIndex.includes(entry));
if (missingExports.length > 0) {
  console.error(`Shared package is missing API SDK contract exports: ${missingExports.join(", ")}`);
  process.exit(1);
}

console.log("API SDK generation plan smoke test passed.");
