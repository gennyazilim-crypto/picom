import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const checkpointNames = readdirSync("docs/task-checkpoints");
const commitSubjects = execFileSync("git", ["log", "--all", "--format=%s"], { encoding: "utf8" }).split(/\r?\n/);
const missingCheckpoints = [];
const missingCommits = [];

for (let task = 251; task <= 349; task += 1) {
  if (!checkpointNames.some((name) => name.startsWith(`task-${task}-`) && name.endsWith(".md"))) missingCheckpoints.push(task);
  if (!commitSubjects.some((subject) => subject.startsWith(`task-${task} `))) missingCommits.push(task);
}

assert(missingCheckpoints.length === 0, `Missing checkpoints: ${missingCheckpoints.join(", ")}`);
assert(missingCommits.length === 0, `Missing commits: ${missingCommits.join(", ")}`);

const audit = readFileSync("docs/final-long-term-backlog-audit.md", "utf8");
for (const marker of ["Completed delivery ledger", "Blocked external evidence", "Deferred outcomes", "Rejected decisions", "Product", "Security", "Operations", "Enterprise", "Next 20 highest-value tasks"])
  assert(audit.includes(marker), `Backlog audit is missing ${marker}`);
const priorityRows = audit.match(/^\| (?:[1-9]|1\d|20) \|/gm) ?? [];
assert(priorityRows.length === 20, `Expected 20 prioritized backlog rows, found ${priorityRows.length}`);

console.log("Final long-term backlog audit passed: 99 checkpoints, 99 commits, 20 prioritized next tasks.");
