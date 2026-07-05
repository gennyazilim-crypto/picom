import { readFileSync } from "node:fs";

const service = readFileSync("src/services/messageModerationFilterService.ts", "utf8");
const component = readFileSync("src/components/MessageModerationFiltersPanel.tsx", "utf8");
const sidebar = readFileSync("src/components/CommunitySidebar.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

const failures = [];

if (!service.includes("blockedWords")) failures.push("Moderation service should support blocked words.");
if (!service.includes("maxMentionsPerMessage")) failures.push("Moderation service should support mention limits.");
if (!service.includes("checkMessage")) failures.push("Moderation service should expose checkMessage().");
if (!component.includes("Local blocked words placeholder")) failures.push("Moderation UI should clearly mark local placeholder behavior.");
if (!sidebar.includes("MessageModerationFiltersPanel")) failures.push("CommunitySidebar should mount moderation filters panel.");
if (!app.includes("messageModerationFilterService.checkMessage")) failures.push("Message send should check moderation filters before sending.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Message moderation filters smoke passed.");