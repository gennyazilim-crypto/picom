import { readFileSync } from "node:fs";

const service = readFileSync("src/services/communityOwnershipTransferService.ts", "utf8");
const component = readFileSync("src/components/CommunityOwnershipTransferPanel.tsx", "utf8");
const sidebar = readFileSync("src/components/CommunitySidebar.tsx", "utf8");

const failures = [];

if (!service.includes('!== "Owner"')) {
  failures.push("Ownership transfer placeholder must restrict preparation to the current owner.");
}

if (!service.includes("confirmationName.trim() !== community.name")) {
  failures.push("Ownership transfer placeholder must require exact community name confirmation.");
}

if (!service.includes("Target user must be a current community member")) {
  failures.push("Ownership transfer placeholder must validate target membership.");
}

if (!component.includes("Owner-only placeholder")) {
  failures.push("UI should clearly mark ownership transfer as an owner-only placeholder.");
}

if (!sidebar.includes("CommunityOwnershipTransferPanel")) {
  failures.push("CommunitySidebar should mount the ownership transfer panel.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Community ownership transfer smoke passed.");