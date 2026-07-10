import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const files = {
  qa: ".github/workflows/qa.yml",
  hosted: ".github/workflows/hosted-validation.yml",
  packages: ".github/workflows/package-matrix.yml",
  release: ".github/workflows/release-gate.yml",
  performance: ".github/workflows/renderer-performance.yml",
};

const contents = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, path]) => [
      key,
      await readFile(resolve(root, path), "utf8"),
    ]),
  ),
);

const failures = [];

function requireText(workflow, pattern, label) {
  if (!pattern.test(contents[workflow])) {
    failures.push(`${files[workflow]} is missing ${label}.`);
  }
}

function forbidText(workflow, pattern, label) {
  if (pattern.test(contents[workflow])) {
    failures.push(`${files[workflow]} must not contain ${label}.`);
  }
}

for (const workflow of Object.keys(files)) {
  requireText(workflow, /permissions:\s*\n\s+contents: read/, "minimal contents: read permissions");
  requireText(workflow, /concurrency:/, "concurrency controls");
  requireText(workflow, /timeout-minutes:/, "a job timeout");
  forbidText(workflow, /continue-on-error:/, "continue-on-error");
  forbidText(workflow, /service[_-]?role/i, "a Supabase service-role credential");
}

for (const command of [
  "npm ci",
  "npm run typecheck",
  "npm run mock:smoke",
  "npm run build",
  "npm run qa:smoke",
]) {
  requireText("qa", new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), command);
}

requireText("qa", /runs-on: ubuntu-latest/, "a deterministic Linux runner");
requireText("qa", /cancel-in-progress: true/, "superseded-run cancellation");
requireText("qa", /node-version: 24/, "the established Node.js 24 runtime");
requireText("qa", /cache-dependency-path: package-lock\.json/, "npm lockfile caching");
forbidText("qa", /strategy:\s*\n\s+matrix:/, "an operating-system matrix");
forbidText("qa", /supabase:rls:hosted:test|realtime:staging:test|edge:staging:test/, "hosted validation commands");
forbidText("qa", /package:(?:win|mac|linux)|notari[sz]|signing|backup|restore/i, "native or release-only commands");
forbidText("qa", /paths-ignore:/, "workflow-level paths-ignore");
forbidText("qa", /actions\/upload-artifact/, "artifact uploads");

requireText("hosted", /workflow_dispatch:/, "a manual trigger");
requireText("hosted", /environment: hosted-staging/, "the protected hosted-staging environment");
for (const command of [
  "npm run supabase:rls:hosted:test",
  "npm run realtime:staging:test",
  "npm run edge:staging:test",
]) {
  requireText("hosted", new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), command);
}

for (const runner of ["windows-latest", "ubuntu-latest", "macos-latest"]) {
  requireText("packages", new RegExp(`runs-on: ${runner}`), `${runner} native packaging`);
}
for (const command of ["package:win", "package:linux:appimage", "package:linux:deb", "package:mac"]) {
  requireText("packages", new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), command);
}

requireText("release", /branches:\s*\n\s+- release\/\*\*/, "release branch trigger");
requireText("release", /tags:\s*\n\s+- v\*/, "version tag trigger");
for (const command of [
  "performance:budget:ci",
  "visual:regression:contract",
  "e2e:coverage:contract",
  "release:checksums:smoke",
  "release:provenance:smoke",
  "release:go-no-go:guard",
]) {
  requireText("release", new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), command);
}
forbidText("release", /npm publish|gh release create|softprops\/action-gh-release/, "artifact publication");

requireText("performance", /workflow_dispatch:/, "a manual trigger");
requireText("performance", /ubuntu-latest/, "Ubuntu performance evidence");
requireText("performance", /windows-latest/, "Windows performance evidence");
requireText("performance", /npm run build/, "a production renderer build");
requireText("performance", /npm run performance:budget:ci/, "the renderer performance budget gate");

if (failures.length > 0) {
  console.error("GitHub Actions workflow contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("GitHub Actions workflow contract passed.");
