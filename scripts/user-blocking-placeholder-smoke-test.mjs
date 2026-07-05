import { readFileSync } from "node:fs";

const service = readFileSync("src/services/userBlockingService.ts", "utf8");
const popover = readFileSync("src/components/UserProfilePopover.tsx", "utf8");
const list = readFileSync("src/components/MessageList.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

const failures = [];

if (!service.includes("blockUser") || !service.includes("unblockUser")) failures.push("userBlockingService should support block and unblock.");
if (!service.includes("local_placeholder")) failures.push("user blocking should be clearly local placeholder state.");
if (!popover.includes("Block") || !popover.includes("Unblock")) failures.push("UserProfilePopover should expose Block/Unblock actions.");
if (!list.includes("Blocked user message")) failures.push("MessageList should collapse blocked user messages.");
if (!app.includes("handleToggleBlockUser")) failures.push("App should wire block/unblock state updates.");
if (!app.includes("You cannot block your own account")) failures.push("App should prevent self-blocking.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("User blocking placeholder smoke passed.");