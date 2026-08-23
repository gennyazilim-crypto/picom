import { spawnSync } from "node:child_process";

const npmCliPath = process.env.npm_execpath;
const npmCommand = npmCliPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
const checks = [
  ["run", "env:smoke"],
  ["run", "qa:output:smoke"],
  ["run", "react:hooks:smoke"],
  ["run", "logs:smoke"],
  ["run", "diagnostics:smoke"],
  ["run", "errors:smoke"],
  ["run", "crash:smoke"],
  ["run", "secrets:smoke"],
  ["run", "renderer:native:smoke"],
  ["run", "branding:smoke"],
  ["run", "desktop:smoke"],
  ["run", "electron:security:smoke"],
  ["run", "packaging:smoke"],
  ["run", "settings:diagnostics:smoke"],
  ["run", "livekit:smoke"],
  ["run", "mock:smoke"],
  // i18n gates: registry/BCP-47 correctness, 10-locale catalog integrity, and Electron
  // main-process catalog anti-drift. The hardcoded-string audit is intentionally NOT in
  // this gate yet — it currently reports the known untranslated backlog and would block
  // every unrelated commit; add it here once that backlog reaches zero.
  ["run", "i18n:locale-registry:smoke"],
  ["run", "i18n:catalog-integrity:smoke"],
  ["run", "i18n:electron-bridge:smoke"]
];

for (const args of checks) {
  const label = `npm ${args.join(" ")}`;
  console.log(`\n> ${label}`);

  const result = spawnSync(npmCommand, npmCliPath ? [npmCliPath, ...args] : args, {
    stdio: "inherit",
    shell: false
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`QA smoke gate failed: ${label}`);
  }
}

console.log("\nOK Picom QA smoke gate completed");
