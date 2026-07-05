import { readFileSync } from "node:fs";

const state = readFileSync("src/state/useLocalMessageState.ts", "utf8");
const category = readFileSync("src/components/ChannelCategory.tsx", "utf8");
const sidebar = readFileSync("src/components/CommunitySidebar.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

const failures = [];

if (!state.includes("const moveChannel")) failures.push("useLocalMessageState should expose moveChannel().");
if (!state.includes("nextChannels.splice")) failures.push("moveChannel should reorder channels locally.");
if (!category.includes("channel-reorder-controls")) failures.push("ChannelCategory should render reorder controls.");
if (!category.includes("Move ${channel.name} up")) failures.push("Reorder controls should have accessible labels.");
if (!sidebar.includes("canReorderChannels") || !sidebar.includes("showReorderControls")) failures.push("CommunitySidebar should gate reorder controls by owner/admin capability.");
if (!app.includes("onMoveChannel")) failures.push("App should wire onMoveChannel into local state.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Channel reorder UI smoke passed.");