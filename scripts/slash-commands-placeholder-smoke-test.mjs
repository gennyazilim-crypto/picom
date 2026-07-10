import fs from "node:fs";

const service = fs.readFileSync("src/services/slashCommandService.ts", "utf8");
const composer = fs.readFileSync("src/components/MessageComposer.tsx", "utf8");
const doc = fs.readFileSync("docs/slash-command-registry.md", "utf8");

const requiredServiceMarkers = [
  'source: "builtin"',
  'source: "bot" | "plugin"',
  "MAX_SUGGESTIONS = 8",
  "registerExternalMetadata",
  "External slash commands accept metadata only.",
  "canUseCommand",
];
const missingServiceMarkers = requiredServiceMarkers.filter((marker) => !service.includes(marker));
if (missingServiceMarkers.length) {
  console.error(`Slash command registry is missing: ${missingServiceMarkers.join(", ")}`);
  process.exit(1);
}

if (!composer.includes("getSuggestions(body, slashPermissionContext)") || !composer.includes("canUseCommand(command, slashPermissionContext)")) {
  console.error("Composer does not enforce slash command permissions at suggestion and selection time.");
  process.exit(1);
}

for (const marker of ["metadata-only", "never executes", "Built-in", "bot", "plugin", "permission", "eight"]) {
  if (!doc.includes(marker)) {
    console.error(`Slash command registry documentation is missing: ${marker}`);
    process.exit(1);
  }
}

console.log("Slash command registry smoke passed.");
