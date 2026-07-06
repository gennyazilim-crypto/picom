import fs from "node:fs";

const doc = fs.readFileSync("docs/staging-smoke-test.md", "utf8");

if (process.argv.includes("--verify-doc")) {
  const required = [
    "backend health",
    "Database migration",
    "Auth register",
    "Auth login",
    "Create community",
    "Create channel",
    "Send message",
    "Realtime two clients",
    "Upload attachment",
    "Permissions",
    "Windows desktop",
    "Linux desktop",
    "No mobile UI",
    "No Discord branding",
    "Do not use production secrets",
  ];
  const missing = required.filter((item) => !doc.toLowerCase().includes(item.toLowerCase()));
  if (missing.length > 0) {
    console.error(`Staging smoke workflow is missing: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("Staging smoke workflow smoke test passed.");
  process.exit(0);
}

console.log("Picom staging smoke placeholder");
console.log("This placeholder is safe by default and does not contact staging.");
console.log("Read docs/staging-smoke-test.md and run the checklist manually before release promotion.");
