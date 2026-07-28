import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const releaseDirectory = path.resolve("release");
const targetArgument = process.argv.find((value) => value.startsWith("--target="));
const target = (targetArgument?.slice("--target=".length) || process.env.PICOM_UPDATE_DEPLOY_TARGET || "").trim();
const portArgument = process.argv.find((value) => value.startsWith("--port="));
const port = (portArgument?.slice("--port=".length) || process.env.PICOM_UPDATE_DEPLOY_PORT || "22").trim();
const dryRun = process.argv.includes("--dry-run");

if (!/^\d{1,5}$/.test(port)) throw new Error("Update deploy port must be numeric.");
if (!target && !dryRun) throw new Error("Set PICOM_UPDATE_DEPLOY_TARGET or pass --target=user@host:/absolute/update/path/.");

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const prerelease = String(packageJson.version).split("-")[1]?.split(".")[0];
const preferredManifest = prerelease === "beta" || prerelease === "dev" ? `${prerelease}.yml` : "latest.yml";
const releaseFiles = await readdir(releaseDirectory);
const manifestName = releaseFiles.includes(preferredManifest) ? preferredManifest : releaseFiles.find((name) => /^(latest|beta|dev)\.yml$/i.test(name));

if (!manifestName) throw new Error(`No updater manifest was found in ${releaseDirectory}. Build the Windows installer first.`);
const manifestText = await readFile(path.join(releaseDirectory, manifestName), "utf8");
const referencedNames = [...manifestText.matchAll(/^\s*(?:url|path):\s*["']?([^"'\r\n]+?)["']?\s*$/gim)].map((match) => match[1].trim()).filter((name) => name && path.basename(name) === name && !name.includes(".."));
const artifactNames = [...new Set(referencedNames)];
for (const name of [...artifactNames]) if (releaseFiles.includes(`${name}.blockmap`)) artifactNames.push(`${name}.blockmap`);
for (const name of artifactNames) await access(path.join(releaseDirectory, name));

console.log(`Update channel manifest: ${manifestName}`);
console.log(`Artifacts: ${artifactNames.join(", ")}`);
if (dryRun) process.exit(0);

const targetMatch = /^([A-Za-z0-9_.@-]+):(\/[A-Za-z0-9_./-]+\/$)/.exec(target);
if (!targetMatch) throw new Error("Deploy target must look like user@host:/absolute/update/path/ and contain no spaces.");
const [, remoteHost, remotePath] = targetMatch;

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}.`);
}

const scpBase = ["-P", port, "-o", "BatchMode=yes"];
if (artifactNames.length) run("scp", [...scpBase, ...artifactNames.map((name) => path.join(releaseDirectory, name)), `${remoteHost}:${remotePath}`]);
const stagedManifest = `${remotePath}${manifestName}.next`;
run("scp", [...scpBase, path.join(releaseDirectory, manifestName), `${remoteHost}:${stagedManifest}`]);
run("ssh", ["-p", port, "-o", "BatchMode=yes", remoteHost, `mv -- '${stagedManifest}' '${remotePath}${manifestName}'`]);
console.log(`Published Picom ${packageJson.version} to ${remoteHost}:${remotePath}. The manifest was promoted last.`);
