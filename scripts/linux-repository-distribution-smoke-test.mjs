import { readFile } from "node:fs/promises";

const [plan, packaging, releaseBuild, builder, packageText] = await Promise.all([
  readFile("docs/linux-repository-distribution.md", "utf8"),
  readFile("docs/linux-packaging.md", "utf8"),
  readFile("docs/linux-release-build.md", "utf8"),
  readFile("electron-builder.yml", "utf8"),
  readFile("package.json", "utf8"),
]);

const checks = [
  [plan.includes("repository publishing is **not enabled**") && plan.includes("rpm x64") && plan.includes("not configured"), "safe current format status"],
  [plan.includes("linux/beta/apt") && plan.includes("linux/stable/rpm") && plan.includes("immutable channels"), "channel layout"],
  [plan.includes("AppStream metadata contract") && plan.includes("com.picom.desktop") && plan.includes("desktop-file-validate") && plan.includes("appstreamcli validate"), "desktop metadata gate"],
  [plan.includes("offline/restricted root key") && plan.includes("InRelease") && plan.includes("repomd.xml") && plan.includes("revocation"), "package signing lifecycle"],
  [plan.includes("signed-by=") && plan.includes("Never suggest disabling GPG checks") && plan.includes("gpgcheck=0"), "safe install policy"],
  [plan.includes("backend minimum client version") && plan.includes("forward hotfix"), "safe rollback boundary"],
  [packaging.includes("linux-repository-distribution.md") && releaseBuild.includes("linux-repository-distribution.md"), "existing docs integrated"],
  [builder.includes("target: AppImage") && builder.includes("target: deb") && !builder.includes("target: rpm"), "unverified rpm target not enabled"],
  [packageText.includes('"linux:repository:distribution:smoke"'), "smoke command"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
