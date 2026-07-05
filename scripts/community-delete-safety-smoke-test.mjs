import { readFileSync } from "node:fs";

const service = readFileSync("src/services/communityDeleteSafetyService.ts", "utf8");
const component = readFileSync("src/components/CommunityDeleteSafetyPanel.tsx", "utf8");
const sidebar = readFileSync("src/components/CommunitySidebar.tsx", "utf8");

const failures = [];

if (!service.includes("Only the community owner")) {
  failures.push("Community delete safety must be owner-only.");
}

if (!service.includes("confirmationName.trim() !== community.name")) {
  failures.push("Community delete safety must require exact community name confirmation.");
}

if (!service.includes("The community was not deleted")) {
  failures.push("Community delete safety must clearly avoid destructive deletion.");
}

if (!component.includes("Owner-only soft delete placeholder")) {
  failures.push("UI should clearly mark delete flow as an owner-only soft delete placeholder.");
}

if (!sidebar.includes("CommunityDeleteSafetyPanel")) {
  failures.push("CommunitySidebar should mount the delete safety panel.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Community delete safety smoke passed.");