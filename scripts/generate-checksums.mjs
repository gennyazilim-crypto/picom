import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ARTIFACT_EXTENSIONS = new Set([".exe", ".msi", ".appimage", ".deb", ".rpm", ".dmg", ".zip"]);

function parseArgs(argv) {
  const args = {
    dir: "release",
    output: "",
    strict: false,
  };

  for (const arg of argv) {
    if (arg === "--strict") {
      args.strict = true;
      continue;
    }

    if (arg.startsWith("--dir=")) {
      args.dir = arg.slice("--dir=".length);
      continue;
    }

    if (arg.startsWith("--output=")) {
      args.output = arg.slice("--output=".length);
    }
  }

  args.output = args.output || path.join(args.dir, "SHA256SUMS.txt");
  return args;
}

function walkFiles(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.isFile()) files.push(fullPath);
  }

  return files;
}

function isReleaseArtifact(filePath) {
  const normalized = filePath.toLowerCase();
  return ARTIFACT_EXTENSIONS.has(path.extname(normalized));
}

function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function writeChecksums({ rootDir, outputPath, files }) {
  const lines = files
    .sort((a, b) => a.localeCompare(b))
    .map((filePath) => {
      const hash = sha256File(filePath);
      const relative = path.relative(rootDir, filePath).replace(/\\/g, "/");
      return `${hash}  ${relative}`;
    });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  return lines.length;
}

const args = parseArgs(process.argv.slice(2));
const rootDir = path.resolve(args.dir);
const outputPath = path.resolve(args.output);

if (!fs.existsSync(rootDir)) {
  const message = `Release artifact directory not found: ${rootDir}`;
  if (args.strict) {
    console.error(message);
    process.exit(1);
  }

  console.log(`${message}. Skipping checksum generation.`);
  process.exit(0);
}

const artifacts = walkFiles(rootDir).filter((filePath) => {
  if (path.resolve(filePath) === outputPath) return false;
  return isReleaseArtifact(filePath);
});

if (!artifacts.length) {
  const message = `No release artifacts found in ${rootDir}`;
  if (args.strict) {
    console.error(message);
    process.exit(1);
  }

  console.log(`${message}. Skipping checksum generation.`);
  process.exit(0);
}

const count = writeChecksums({ rootDir, outputPath, files: artifacts });
console.log(`Generated SHA256 checksums for ${count} artifact(s): ${outputPath}`);

