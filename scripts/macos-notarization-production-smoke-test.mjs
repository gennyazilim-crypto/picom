import { readFile } from "node:fs/promises";

const [workflow, releaseConfig, verifier, mainEntitlements, inheritedEntitlements, docs, packageText] = await Promise.all([
  readFile(".github/workflows/macos-signed-notarized-release.yml", "utf8"),
  readFile("electron-builder.macos-release.yml", "utf8"),
  readFile("scripts/verify-macos-signing.sh", "utf8"),
  readFile("assets/brand/entitlements.mac.plist", "utf8"),
  readFile("assets/brand/entitlements.mac.inherit.plist", "utf8"),
  readFile("docs/release/macos-signing-notarization-final.md", "utf8"),
  readFile("package.json", "utf8"),
]);

const entitlements = `${mainEntitlements}\n${inheritedEntitlements}`;
const checks = [
  [workflow.includes("workflow_dispatch") && workflow.includes("environment: macos-production-signing") && !workflow.includes("pull_request:"), "protected manual workflow"],
  [workflow.includes("secrets.MACOS_CSC_LINK") && workflow.includes("secrets.APPLE_API_KEY_P8_BASE64") && workflow.includes("rm -f"), "CI-only ephemeral credentials"],
  [releaseConfig.includes("hardenedRuntime: true") && releaseConfig.includes("notarize: true") && releaseConfig.includes("entitlements.mac.plist"), "release-only hardened/notarized config"],
  [verifier.includes("codesign --verify --deep --strict") && verifier.includes("spctl --assess") && verifier.includes("xcrun stapler validate"), "signature, Gatekeeper and staple checks"],
  [entitlements.includes("com.apple.security.device.audio-input") && !entitlements.includes("com.apple.security.get-task-allow") && !entitlements.includes("disable-library-validation"), "reviewed microphone/Electron entitlements"],
  [workflow.includes("Generate post-stapling checksum") && !workflow.includes("gh release") && !workflow.includes("publish: true"), "post-stapling evidence without publishing"],
  [docs.includes("Protected production CI") && docs.includes("Microphone permission") && docs.includes("Screen recording permission"), "production and permission guidance"],
  [packageText.includes('"macos:notarization:production:smoke"') && packageText.includes('"package:mac:signed-candidate"'), "commands registered"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) { for (const [, label] of failed) console.error(`FAIL: ${label}`); process.exit(1); }
for (const [, label] of checks) console.log(`PASS: ${label}`);
