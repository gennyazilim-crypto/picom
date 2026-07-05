import fs from "node:fs";

const service = fs.readFileSync("src/services/accountSwitcherService.ts", "utf8");
const doc = fs.readFileSync("docs/multi-account-placeholder.md", "utf8");

const forbidden = [/password/i, /accessToken/, /refreshToken/, /authorization/i];
const serviceWithoutComments = service.replace(/\/\/.*$/gm, "");
const forbiddenHits = forbidden.filter((pattern) => pattern.test(serviceWithoutComments));
if (forbiddenHits.length) {
  console.error("Account switcher service appears to store sensitive credential fields.");
  process.exit(1);
}

const checks = [
  [service.includes("AccountSwitcherEntry"), "typed account metadata"],
  [service.includes("rememberAccount"), "remember account method"],
  [service.includes("removeAccount"), "remove account method"],
  [service.includes("picom.accountSwitcher.metadata.v1"), "safe storage key"],
  [doc.includes("does not store credentials or auth tokens"), "security documentation"],
  [doc.includes("Switch account"), "future UI placeholder"]
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  console.error(`Multi-account placeholder smoke failed: ${failed.join(", ")}`);
  process.exit(1);
}

console.log("Multi-account placeholder smoke passed.");
