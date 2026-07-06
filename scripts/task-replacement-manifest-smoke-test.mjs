import fs from "node:fs";

const base = "docs/tasks-electron-supabase-livekit-all-old-new-001-473";
const requiredFiles = [
  `${base}/TASK_INDEX.txt`,
  `${base}/TASK_INDEX.csv`,
  `${base}/tasks_metadata.json`,
  `${base}/README.txt`,
  `${base}/TASKS_TO_REPLACE_INDEX.txt`,
  `${base}/tasks_replacement_metadata.json`,
  `${base}/task_127_ADDENDUM_first_run_onboarding.txt`,
];
const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file));
const metadata = JSON.parse(fs.readFileSync(`${base}/tasks_replacement_metadata.json`, "utf8"));
const index = fs.readFileSync(`${base}/TASKS_TO_REPLACE_INDEX.txt`, "utf8");
const missingTaskFiles = metadata
  .map((entry) => `${base}/task_${String(entry.task).padStart(3, "0")}.txt`)
  .filter((file) => !fs.existsSync(file));
const requiredIndexText = ["CHANGED TASKS INDEX", "Replace these files", "EXTRA ADDENDUM FILES"];
const missingIndexText = requiredIndexText.filter((text) => !index.includes(text));

if (missingFiles.length > 0 || metadata.length !== 150 || missingTaskFiles.length > 0 || missingIndexText.length > 0) {
  console.error(
    `Replacement manifest smoke failed missingFiles=${missingFiles.join(", ")} metadataCount=${metadata.length} missingTaskFiles=${missingTaskFiles.join(", ")} missingIndexText=${missingIndexText.join(", ")}`,
  );
  process.exit(1);
}
console.log("Task replacement manifest smoke test passed.");
