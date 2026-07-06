import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.join(".tmp", "checksum-smoke");
const output = path.join(root, "SHA256SUMS.txt");

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, "Picom Setup 0.1.0.exe"), "windows-installer-placeholder");
fs.writeFileSync(path.join(root, "Picom-0.1.0.AppImage"), "linux-appimage-placeholder");
fs.writeFileSync(path.join(root, "picom_0.1.0_amd64.deb"), "linux-deb-placeholder");
fs.writeFileSync(path.join(root, "picom-0.1.0.x86_64.rpm"), "linux-rpm-placeholder");
fs.writeFileSync(path.join(root, "not-an-artifact.txt"), "ignore-me");

execFileSync(process.execPath, ["scripts/generate-checksums.mjs", `--dir=${root}`, `--output=${output}`, "--strict"], { stdio: "pipe" });

const checksums = fs.readFileSync(output, "utf8");
const expectedFiles = [
  "Picom Setup 0.1.0.exe",
  "Picom-0.1.0.AppImage",
  "picom_0.1.0_amd64.deb",
  "picom-0.1.0.x86_64.rpm",
];

for (const fileName of expectedFiles) {
  const expectedHash = createHash("sha256").update(fs.readFileSync(path.join(root, fileName))).digest("hex");
  const expectedLine = `${expectedHash}  ${fileName}`;
  if (!checksums.includes(expectedLine)) {
    throw new Error(`Missing checksum line: ${expectedLine}`);
  }
}

if (checksums.includes("not-an-artifact.txt")) {
  throw new Error("Checksum output included a non-artifact file.");
}

fs.rmSync(root, { recursive: true, force: true });
console.log("Release artifact checksum smoke test passed.");

