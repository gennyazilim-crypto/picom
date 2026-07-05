import { readFileSync } from "node:fs";

const state = readFileSync("src/state/useLocalMessageState.ts", "utf8");
const component = readFileSync("src/components/CommunityCategoryManagementPanel.tsx", "utf8");
const sidebar = readFileSync("src/components/CommunitySidebar.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

const failures = [];

for (const expected of ["addCategory", "renameCategory", "deleteCategory"]) {
  if (!state.includes(expected)) failures.push(`useLocalMessageState should expose ${expected}.`);
}

if (!state.includes("movedChannels")) {
  failures.push("Deleting a category should move channels safely instead of deleting them.");
}

if (!component.includes("Owner/Admin local management")) {
  failures.push("Category management panel should be owner/admin scoped.");
}

if (!sidebar.includes("CommunityCategoryManagementPanel")) {
  failures.push("CommunitySidebar should mount the category management panel.");
}

if (!app.includes("onCreateCategory")) {
  failures.push("App should wire category create/edit/delete handlers.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Channel category management smoke passed.");