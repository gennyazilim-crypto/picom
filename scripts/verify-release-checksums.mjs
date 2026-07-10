import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith("--") && arg.includes("=")).map((arg) => {
  const separator = arg.indexOf("=");
  return [arg.slice(2, separator), arg.slice(separator + 1)];
}));
const root = path.resolve(args.dir ?? "release");
const manifest = path.resolve(args.manifest ?? path.join(root, "SHA256SUMS.txt"));

if (!fs.existsSync(manifest)) throw new Error(`Checksum manifest not found: ${manifest}`);
const lines = fs.readFileSync(manifest, "utf8").split(/\r?\n/).filter(Boolean);
if (!lines.length) throw new Error("Checksum manifest is empty");

for (const line of lines) {
  const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
  if (!match) throw new Error(`Invalid checksum line: ${line}`);
  const [, expected, relative] = match;
  const artifact = path.resolve(root, relative);
  if (!artifact.startsWith(`${root}${path.sep}`)) throw new Error(`Checksum path escapes artifact directory: ${relative}`);
  if (!fs.existsSync(artifact) || !fs.statSync(artifact).isFile()) throw new Error(`Artifact is missing: ${relative}`);
  const actual = createHash("sha256").update(fs.readFileSync(artifact)).digest("hex");
  if (actual !== expected) throw new Error(`Checksum mismatch: ${relative}`);
}

console.log(`Verified SHA256 checksums for ${lines.length} artifact(s).`);
