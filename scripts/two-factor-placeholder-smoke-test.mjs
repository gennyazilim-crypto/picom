import { readFileSync } from "node:fs";

const service = readFileSync("src/services/twoFactorAuthService.ts", "utf8");
const settings = readFileSync("src/components/SettingsModal.tsx", "utf8");

const failures = [];

for (const pattern of [/access_token/i, /refresh_token/i, /authorization/i, /totpSecret/i, /mfaSecret/i, /recoveryCodeSecret/i, /console\\.(log|warn|error|info)/]) {
  if (pattern.test(service)) {
    failures.push(`twoFactorAuthService must not expose sensitive MFA material or logs: ${pattern}`);
  }
}

if (!service.includes("prepareSetupPlaceholder")) {
  failures.push("twoFactorAuthService should expose prepareSetupPlaceholder().");
}

if (!service.includes("regenerateRecoveryCodesPlaceholder")) {
  failures.push("twoFactorAuthService should expose recovery-code placeholder action.");
}

if (!settings.includes("Enable 2FA placeholder")) {
  failures.push("Settings > Account should expose Enable 2FA placeholder.");
}

if (!settings.includes("Recovery codes placeholder")) {
  failures.push("Settings > Account should expose Recovery codes placeholder.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Two-factor placeholder smoke passed.");