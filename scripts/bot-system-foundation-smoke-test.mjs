import { existsSync, readFileSync } from "node:fs";

const docPath = "docs/bot-system-foundation.md";
const failures = [];

if (!existsSync(docPath)) {
  failures.push("Bot system foundation document is missing.");
} else {
  const doc = readFileSync(docPath, "utf8");
  for (const expected of ["post-MVP", "No arbitrary code execution", "Bot tokens", "Security boundaries", "MVP stance"]) {
    if (!doc.includes(expected)) failures.push(`Bot system foundation should mention: ${expected}`);
  }
}

const runtimeFiles = ["src/App.tsx", "src/components/SettingsModal.tsx"].map((file) => readFileSync(file, "utf8")).join("\n");
if (/bot marketplace|execute bot|bot token/i.test(runtimeFiles)) {
  failures.push("Bot foundation task should not add visible runtime bot features.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Bot system foundation smoke passed.");