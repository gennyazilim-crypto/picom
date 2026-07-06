import fs from "node:fs";

const doc = fs.readFileSync("docs/secret-scanning.md", "utf8");
const workflow = fs.readFileSync(".github/workflows/qa.yml", "utf8");

const requiredDoc = [
  "Secret Scanning CI Placeholder",
  "npm run secrets:smoke",
  "gitleaks detect",
  "trufflehog filesystem",
  "Allowlist placeholder",
  "frontend renderer",
  "documentation under `docs/`",
  "CI workflow files",
  "Do not add real secrets",
];

const missingDoc = requiredDoc.filter((item) => !doc.toLowerCase().includes(item.toLowerCase()));
if (missingDoc.length > 0) {
  console.error(`Secret scanning doc is missing: ${missingDoc.join(", ")}`);
  process.exit(1);
}

if (!workflow.includes("npm run secrets:smoke")) {
  console.error("QA workflow does not include npm run secrets:smoke.");
  process.exit(1);
}

console.log("Secret scanning CI placeholder smoke test passed.");
