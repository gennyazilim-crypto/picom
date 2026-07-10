import fs from "node:fs";

const docPath = "docs/performance-budget.md";
const doc = fs.readFileSync(docPath, "utf8");

const required = [
  "App shell first render",
  "Login screen render",
  "Main chat render with mock data",
  "Settings modal open",
  "Command palette open",
  "Channel switch",
  "Message send optimistic update",
  "Image attachment preview",
  "Memory usage placeholder",
  "Renderer JS bundle placeholder",
  "measurement flows",
  "Recommended tools",
  "Regression policy",
  "CI enforcement",
  "performance:budget:ci",
  "Hard fail",
];

const missing = required.filter((item) => !doc.includes(item));
if (missing.length > 0) {
  console.error(`Performance budget is missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Performance budget smoke test passed.");
