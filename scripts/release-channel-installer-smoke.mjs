import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const channelModule = readFileSync("src/config/releaseChannel.ts", "utf8");
const appConfig = readFileSync("src/config/appConfig.ts", "utf8");
const builder = readFileSync("electron-builder.yml", "utf8");
const envExample = readFileSync(".env.example", "utf8");

if (!channelModule.includes('["dev", "beta", "stable"]')) throw new Error("Release channel contract is incomplete.");
if (!channelModule.includes("deriveReleaseChannelFromVersion") || !channelModule.includes('return prerelease === "beta" ? "beta" : "dev"')) throw new Error("Beta version fallback is missing.");
if (!channelModule.includes("Stable is never inferred")) throw new Error("Stable must fail safe when channel config is absent.");
if (!appConfig.includes("resolveReleaseChannel(import.meta.env.VITE_RELEASE_CHANNEL, environment, appVersion)")) throw new Error("About/runtime channel is not aligned to app version.");
if (!builder.includes("picomReleaseChannel: ${channel}")) throw new Error("Packaged metadata does not include the builder channel.");
for (const platform of ["Windows", "Linux", "macOS"]) {
  if (!builder.includes(`Picom-\${version}-\${channel}-${platform}-\${arch}.\${ext}`)) throw new Error(`Artifact name is missing ${platform} channel metadata.`);
}
if (!envExample.includes("VITE_RELEASE_CHANNEL=dev") || !envExample.includes("VITE_RELEASE_CHANNEL=stable explicitly")) throw new Error("Safe release channel environment guidance is missing.");
if (!String(pkg.version).includes("-beta.")) throw new Error("Current candidate is expected to remain a beta prerelease.");

console.log(`Installer release channel smoke passed for ${pkg.version}; stable remains explicit-only.`);
