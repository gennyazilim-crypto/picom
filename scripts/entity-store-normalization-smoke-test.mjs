import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const sourcePath = resolve(root, "src/state/entityStore.ts");
const docsPath = resolve(root, "docs/entity-store-normalization.md");

if (!existsSync(sourcePath)) {
  throw new Error("Missing normalized entity store helper.");
}

if (!existsSync(docsPath)) {
  throw new Error("Missing entity store normalization documentation.");
}

const source = readFileSync(sourcePath, "utf8");
const docs = readFileSync(docsPath, "utf8");

const requiredSourceTerms = [
  "createNormalizedEntityStore",
  "communitiesById",
  "channelsById",
  "messagesById",
  "membersById",
  "messageIdsByChannelId",
  "selectMessagesForChannel",
  "selectMembersForCommunity"
];

for (const term of requiredSourceTerms) {
  if (!source.includes(term)) {
    throw new Error(`Missing normalized store term: ${term}`);
  }
}

const requiredDocTerms = [
  "Do not replace `useLocalMessageState()` yet",
  "Future migration plan",
  "Manual QA checklist"
];

for (const term of requiredDocTerms) {
  if (!docs.includes(term)) {
    throw new Error(`Missing entity store normalization doc term: ${term}`);
  }
}

console.log("✓ normalized entity store helper");
console.log("✓ typed selector foundation");
console.log("✓ entity store normalization documentation");
