import fs from "node:fs";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const builder = fs.readFileSync("electron-builder.yml", "utf8");
const macRelease = fs.readFileSync("electron-builder.macos-release.yml", "utf8");
const docs = fs.readFileSync("docs/release-artifacts.md", "utf8");
const installerDocs = fs.readFileSync("docs/installer-artifacts.md", "utf8");

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageJson.version)) throw new Error("package.json version is not valid release SemVer");
for (const platform of ["Windows", "Linux", "macOS"]) {
  const pattern = `Picom-\${version}-\${channel}-${platform}-\${arch}.\${ext}`;
  if (!builder.includes(pattern)) throw new Error(`Missing standardized ${platform} artifact name`);
}
if (!macRelease.includes("Picom-${version}-${channel}-macOS-${arch}.${ext}")) throw new Error("Protected macOS artifact name differs from base config");
for (const field of ["<version>", "<channel>", "<arch>", "Version and channel policy"]) {
  if (!docs.includes(field)) throw new Error(`Release artifact documentation is missing ${field}`);
}
for (const field of ["SHA256SUMS.txt", "signing/notarization", "immutable", "Picom-<version>-<channel>"]) {
  if (!installerDocs.includes(field)) throw new Error(`Installer artifact documentation is missing ${field}`);
}

console.log(`Release artifact naming smoke passed for Picom ${packageJson.version}.`);
