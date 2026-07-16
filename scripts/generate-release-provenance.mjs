import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {
    output: "release/provenance.json",
    artifactsDir: "release",
  };

  for (const arg of argv) {
    if (arg.startsWith("--output=")) args.output = arg.slice("--output=".length);
    if (arg.startsWith("--artifacts-dir=")) args.artifactsDir = arg.slice("--artifacts-dir=".length);
  }

  return args;
}

function getGitCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  if (process.env.VITE_GIT_COMMIT) return process.env.VITE_GIT_COMMIT;

  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync("package.json", "utf8"));
}

function listArtifacts(artifactsDir) {
  if (!fs.existsSync(artifactsDir)) return [];

  const allowed = new Set([".exe", ".msi", ".appimage", ".deb", ".rpm", ".dmg", ".zip"]);
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && allowed.has(path.extname(entry.name).toLowerCase())) {
        files.push(path.relative(artifactsDir, fullPath).replace(/\\/g, "/"));
      }
    }
  }

  walk(artifactsDir);
  return files.sort((a, b) => a.localeCompare(b));
}

function getReleaseChannel(version) {
  const configured = process.env.VITE_RELEASE_CHANNEL ?? process.env.RELEASE_CHANNEL;
  if (configured && /^[a-z0-9][a-z0-9-]{0,31}$/i.test(configured)) return configured.toLowerCase();
  const prerelease = version.split("-")[1];
  return prerelease ? prerelease.split(".")[0].toLowerCase() : "latest";
}

function getArtifactMetadata(artifactsDir, artifacts) {
  return artifacts.map((relativePath) => {
    const fullPath = path.join(artifactsDir, relativePath);
    return {
      path: relativePath,
      sizeBytes: fs.statSync(fullPath).size,
      sha256: createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex"),
    };
  });
}

const args = parseArgs(process.argv.slice(2));
const packageJson = readPackageJson();
const gitCommit = getGitCommit();
const outputPath = path.resolve(args.output);
const electronVersion = packageJson.devDependencies?.electron ?? packageJson.dependencies?.electron ?? "unknown";
const artifacts = listArtifacts(args.artifactsDir);

const provenance = {
  schemaVersion: 1,
  productName: "Picom Desktop",
  appVersion: packageJson.version,
  releaseChannel: getReleaseChannel(packageJson.version),
  gitCommit,
  gitCommitShort: gitCommit === "unknown" ? "unknown" : gitCommit.slice(0, 12),
  buildDate: process.env.VITE_BUILD_DATE ?? new Date().toISOString(),
  buildMachine: process.env.CI ? "ci" : "local",
  platform: process.platform,
  architecture: process.arch,
  desktopRuntime: "electron",
  electronVersion,
  nodeVersion: process.version,
  frontendBuildHash: process.env.VITE_FRONTEND_BUILD_HASH ?? "not-generated",
  backendApiCompatibilityVersion: process.env.VITE_API_COMPATIBILITY_VERSION ?? "mvp-placeholder",
  artifacts,
  artifactMetadata: getArtifactMetadata(args.artifactsDir, artifacts),
  notes: "Sensitive credentials, signing material, certificates, and private machine identifiers are excluded.",
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
console.log(`Generated release provenance metadata: ${outputPath}`);
