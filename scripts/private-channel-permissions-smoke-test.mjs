import { readFileSync } from "node:fs";

const modal = readFileSync("src/components/CreateChannelModal.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const service = readFileSync("src/services/privateChannelPermissionService.ts", "utf8");

const failures = [];

if (!modal.includes("Allowed roles placeholder")) {
  failures.push("CreateChannelModal should show allowed role controls for private channels.");
}

if (!modal.includes("allowedRoleIds")) {
  failures.push("CreateChannelModal should include allowedRoleIds in the form value.");
}

if (!service.includes("saveChannelPermissions")) {
  failures.push("privateChannelPermissionService should save local placeholder permissions.");
}

if (!app.includes("privateChannelPermissionService.saveChannelPermissions")) {
  failures.push("App should save private channel role placeholders after channel creation.");
}

if (!modal.includes("Backend RLS will remain the source of truth")) {
  failures.push("Private channel UI should clarify backend/RLS remains source of truth.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Private channel permissions smoke passed.");